const HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models/";
const LANGUAGE_DETECTION_MODEL = "facebook/fasttext-language-identification";
const ENGLISH_HATE_SPEECH_MODEL = "Hate-speech-CNERG/dehatebert-mono-english";
const TAGALOG_HATE_SPEECH_MODEL = "ggpt1006/tl-hatespeech-detection";
const API_TOKEN = "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";
const COLD_START_RETRY_DELAY = 30000; // 30 seconds delay for cold start retries
const MAX_TOKEN_LENGTH = 512; // Maximum length allowed for the models
const CONCURRENCY_LIMIT = 5; // Limit for concurrent requests

async function callHuggingFaceAPI(model, sentence) {
    try {
        // Show loading indicator with the initial message
        const loadingElement = document.getElementById('loadingModel');
        loadingElement.style.display = 'block';
        loadingElement.textContent = 'Processing...';

        const truncatedSentence = truncateToMaxTokens(sentence, MAX_TOKEN_LENGTH);
        console.log(4, `Sending request to model: ${model}`, { inputs: truncatedSentence });

        let retries = 3; // Max number of retries
        let delay = 5000; // 5 seconds delay between retries

        while (retries > 0) {
            const response = await fetch(`${HUGGINGFACE_API_URL}${model}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${API_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ inputs: truncatedSentence }),
            });

            if (response.ok) {
                const result = await response.json();
                // Hide loading message once model has processed the request
                loadingElement.style.display = 'none';
                return result && result[0] ? result[0] : null;
            } else if (response.status === 503) {
                // If 503, wait for retry and show retry message
                loadingElement.textContent = 'Model is loading, please try again later...';
                retries--;
                await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
            } else {
                // Handle other types of errors
                const errorText = await response.text();
                throw new Error(`Error: ${response.status} - ${errorText}`);
            }
        }

        // If max retries reached, notify user
        loadingElement.textContent = 'Model is still loading. Please try again later.';
        // Optionally you can disable retry or hide the loading spinner after some delay
        setTimeout(() => {
            loadingElement.style.display = 'none';
        }, 5000); // Hide the loading indicator after 5 seconds

        throw new Error('Max retries reached. Please try again later.');
    } catch (error) {
        console.log(1, "API request failed: ", error.message);
        document.getElementById('loadingModel').style.display = 'none';
        throw error;
    }
}


// Function to truncate the sentence to the max token limit
function truncateToMaxTokens(text, maxLength) {
    const words = text.split(/\s+/);
    return words.length > maxLength ? words.slice(0, maxLength).join(' ') : text;
}

async function detectLanguage(sentence) {
    const result = await callHuggingFaceAPI(LANGUAGE_DETECTION_MODEL, sentence);
    let language = "english"; // Default to 'english' if no specific language is detected

    if (result && result.length > 0) {
        const isFilipinoLanguage = result.some(pred => 
            ["tgl_Latn", "ceb_Latn", "war_Latn"].includes(pred.label) && pred.score > 0.1 //tagalog, cebuano, waray
        );
        const isEnglish = result.some(pred => pred.label === "eng_Latn" && pred.score > 0.1);

        if (isFilipinoLanguage) {
            language = "tagalog";
        } else if (isEnglish) {
            language = "english";
        }
    }

    console.log(3, `Sentence: "${sentence}"`, 
        `Language Prediction: ${language}`, 
        `Where API was sent: ${LANGUAGE_DETECTION_MODEL}`
    );

    return language;
}

async function callHateSpeechAPI(model, sentence) {
    const prediction = await callHuggingFaceAPI(model, sentence);
    const threshold = getModeThreshold(); // Fetch threshold dynamically

    console.log(`Current mode: ${currentMode}, Threshold used: ${threshold}`);

    const flagged = prediction.filter(pred =>
        (model === ENGLISH_HATE_SPEECH_MODEL && pred.label === "HATE" && pred.score >= threshold) ||
        (model === TAGALOG_HATE_SPEECH_MODEL && pred.label === "LABEL_1" && pred.score >= threshold)
    );

    if (flagged.length > 0) {
        console.log(`Flagged as hate speech:`, JSON.stringify(flagged));
        return flagged;
    } else {
        console.log(`Prediction below threshold (${threshold}). Marked as non-hate speech: Sentence: "${sentence}", Prediction score: ${prediction[0]?.score || 'N/A'}`);
        return prediction; // Return prediction even if not flagged
    }
}