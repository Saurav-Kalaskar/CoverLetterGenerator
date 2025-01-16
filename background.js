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

GENERATE A NATURAL, ENGAGING COVER LETTER USING THESE GUIDELINES:

1. START WITH AN ATTENTION-GRABBING HOOK (choose one approach):

STATISTICS & NUMBERS HOOK:
- "In the 4.5 minutes it takes to read this cover letter, [X] ASU students will have walked through the Memorial Union doors. As someone who thrives on..."
- "It takes 7 positive experiences to offset one negative interaction at a help desk. That's why I've developed..."
- "The average college student spends 17 hours per week studying - but only 20% of that time is truly productive. This insight drove me..."

STORY-BASED HOOK:
- "Last Tuesday, when a student rushed into the tutoring center five minutes before closing, panic-stricken about their statistics final..."
- "When the printer broke down during finals week, with 50 students in line and growing tension in the air..."
- "Three hundred event attendees, one crashed registration system, and fifteen minutes until doors open. That's when I discovered..."

PROBLEM-SOLVING HOOK:
- "The moment I transformed a chaotic stack of research papers into a searchable digital database, I realized..."
- "What started as a simple spreadsheet to track gym equipment maintenance turned into a facility-wide optimization system..."
- "After watching students struggle with room bookings for the fifth time that day, I knew there had to be a better way..."

QUESTION OR PUZZLE HOOK:
- "What do a library catalog, a GPS, and a great research assistant have in common? They all help people find exactly what they need..."
- "How do you turn a 45-minute wait time into a 5-minute solution? This question led me to revolutionize our department's..."
- "Ever wondered why some study groups thrive while others struggle? As a peer tutor, I've cracked the code..."

CHALLENGE SCENARIO HOOK:
- "Picture this: It's orientation week. 2,000 new students. One information desk. And a mission to make every interaction memorable..."
- "Imagine turning the most dreaded part of a student's day - waiting in line - into an opportunity for community building..."
- "Consider the challenge: Make complex research databases as intuitive as social media. That's exactly what I accomplished when..."

INNOVATION HOOK:
- "By combining a simple QR code system with student feedback, I transformed our department's service rating from 3.2 to 4.8 stars..."
- "Who knew that a late-night coding session would lead to a parking optimization system that now serves 500+ students daily?"
- "They said the old filing system was 'good enough.' But good enough isn't in my vocabulary..."

IMPACT STORY HOOK:
- "One simple process change led to a 40% reduction in wait times. This experience taught me the power of..."
- "From helping one struggling student to creating a peer support network of 50+ volunteers, my journey in student services..."
- "When I started as a lab assistant, equipment downtime was 30%. Three months later, it was down to 5%. Here's how..."

2. LETTER STRUCTURE AND FLOW:

First Paragraph:
- Begin with chosen creative hook
- Connect hook naturally to position and department
- Briefly mention most relevant qualification
- Keep engaging but professional

Second Paragraph:
- Detail relevant experience
- Include specific achievements
- Connect directly to job requirements
- Use numbers and metrics when possible

Third Paragraph:
- Highlight unique skills
- Show understanding of department needs
- Connect academic/project work to role
- Emphasize relevant certifications or training

Fourth Paragraph:
- Share specific plans/ideas for role
- Demonstrate knowledge of department goals
- Show enthusiasm for contribution
- Keep focused on value you'll bring

Closing:
- Reaffirm interest
- Confirm availability for specific campus/schedule
- Include clear call to action

3. WRITING GUIDELINES:
- Use active voice throughout
- Include specific examples
- Keep paragraphs focused
- Maintain professional but warm tone
- Match department's communication style
- Use relevant keywords naturally
- Ensure smooth transitions between paragraphs
- Total length: one page maximum

4. CUSTOMIZE BASED ON:
- Specific job requirements
- Department culture
- Campus location
- Schedule requirements
- Technical requirements
- Student service aspects

Note: Generate the letter as a flowing document without any section markers. Each paragraph should transition naturally to the next, creating an engaging narrative that showcases your qualifications and enthusiasm for the role.

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