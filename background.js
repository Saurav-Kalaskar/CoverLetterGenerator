console.log('Background script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request);
    
    if (request.action === "generateCoverLetter") {
        (async () => {
            try {
                const coverLetter = await generateCoverLetter(
                    request.jobDescription,
                    request.resumeText,
                    request.apiKey
                );
                
                // Store the generated cover letter
                await chrome.storage.local.set({
                    'generatedCoverLetter': coverLetter
                });
                
                sendResponse({ coverLetter });
            } catch (error) {
                console.error('Generation error:', error);
                sendResponse({ error: error.message });
            }
        })();
        return true; // Keep message channel open
    }
});

// Add function to retrieve stored cover letter
async function getStoredCoverLetter() {
    const result = await chrome.storage.local.get(['generatedCoverLetter']);
    return result.generatedCoverLetter || '';
}

// 1. Update the function definition to accept apiKey parameter
const generateCoverLetter = async (jobDescription, resumeText, apiKey) => {
    try {
        // Get stored data
        const stored = await chrome.storage.local.get([
            'generatedCoverLetter',
            'lastJobDescription',
            'lastResumeText'
        ]);
        
        // Generate new cover letter if EITHER job description OR resume has changed
        if (stored.generatedCoverLetter && 
            stored.lastJobDescription === jobDescription && 
            stored.lastResumeText === resumeText) {
            console.log('Using stored cover letter - no changes detected');
            return stored.generatedCoverLetter;
        }
        
        console.log('Generating new cover letter - detected changes in resume or job description');

        if (!apiKey) {
            throw new Error('API key is required');
        }

        const currentDate = new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        // Use placeholders if department or campus are not found
        const department = 'Department';
        const state = 'State in the US where this job is located';

        const prompt = `
You are a professional cover letter generator. Create a compelling cover letter following this EXACT format:

[MUST START WITH THIS EXACT HEADER FORMAT:]
Your Name
Your Phone Number | Your Email
Your City, Your Zip Code

${currentDate}

Hiring Manager
${department}
Company Name, ${state}

Dear Hiring Manager,

[FIRST PARAGRAPH GUIDELINES - Create a unique, engaging opening that:]
- Uses creative analogies (can be technical, innovative, or industry-relevant)
- Connects real-world/ ongoing technical concepts to your professional capabilities
- Shows understanding of the role's technical requirements
- Demonstrates immediate value proposition
- Can reference:
  * Technology concepts or principles
  * Industry trends or challenges
  * Educational or research impact
  * Innovation and problem-solving approaches
  * System architecture or infrastructure metaphors
  * Real-world technical scenarios
- Must flow naturally into your qualifications
- Should be unique and not formulaic
- Should be broad to let the reader know that you are a good fit for the job

[REMAINING PARAGRAPHS:]
[Second Paragraph - Highlight specific achievements:]
- Focus on most relevant technical experience
- Include quantifiable results
- Connect directly to job requirements
- Use active voice and specific examples

[Third Paragraph - Demonstrate additional value:]
- Highlight complementary skills
- Show understanding of department needs
- Include relevant academic or project experience
- Demonstrate growth mindset

[Final Paragraph - Strong closing:]
- Express genuine interest in the role
- Reference specific department goals
- Include clear call to action
- Keep professional and confident

End with:
Sincerely,
Your Name

Style Requirements:
- MUST include all header information exactly as shown above
- Create unique, engaging openings not limited to any specific templates
- Maintain professional tone while being creative
- Use natural transitions between paragraphs
- Include technical terms appropriately
- Avoid clichés and generic phrases
- No headers or style labels in the actual letter

Use this job description to identify relevant skills and requirements: ${jobDescription}
And match with experience from this resume: ${resumeText}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            }
        );

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Gemini API response format has this structure:
        // { candidates: [{ content: { parts: [{ text: "..." }] } }] }
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response format from API');
        }

        const generatedText = data.candidates[0].content.parts[0].text;
        
        // After successful generation, store the new values
        await chrome.storage.local.set({
            'generatedCoverLetter': generatedText,
            'lastJobDescription': jobDescription,
            'lastResumeText': resumeText
        });

        return generatedText;

    } catch (error) {
        console.error('Error generating cover letter:', error);
        throw error;
    }
};