const LANGUAGE_DETECTION_MODEL = "http://127.0.0.1:8000/predict-language";
const ENGLISH_HATE_SPEECH_MODEL = "http://127.0.0.1:8000/predict-english";
const TAGALOG_HATE_SPEECH_MODEL = "http://127.0.0.1:8000/predict-tagalog";

async function callAPI(url, sentence) {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: sentence }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log("API response:", result);

        return result;
    } catch (error) {
        console.error("API request failed: ", error.message);
        throw error;
    }
}

async function detectLanguage(sentence) {
    const result = await callAPI(LANGUAGE_DETECTION_MODEL, sentence);

    const predictions = result;

    console.log("Language detection response:", result);
    console.log("Predictions array:", predictions);

    let language = "english"; // Default to 'english' if no specific language is detected

    if (predictions && predictions.length > 0) {
        // Log each prediction to see what scores are being processed
        predictions.forEach(pred => {
            console.log(`Label: ${pred.label}, Score: ${pred.score}`);
        });

        // Check if any Filipino language label has a score above the threshold
        const isFilipinoLanguage = predictions.some(pred => 
            (pred.label === "tgl_Latn" && pred.score > 0.01) || 
            (pred.label === "ceb_Latn" && pred.score > 0.01) || 
            (pred.label === "war_Latn" && pred.score > 0.01)
        );

        // Check if English is detected with a high enough score
        const isEnglish = predictions.some(pred => pred.label === "eng_Latn" && pred.score > 0.1);

        if (isFilipinoLanguage) {
            console.log("Detected as Tagalog language due to high score in Filipino language labels.");
            language = "tagalog";
        } else if (isEnglish) {
            console.log("Detected as English language due to high score in English label.");
            language = "english";
        } else {
            console.log("Detected as unspecified language with low confidence.");
        }
    } else {
        console.log("No valid predictions found in response.");
    }

    console.log(3, `Sentence: "${sentence}"`, `Language Prediction: ${language}`);

    return language;
}

async function callHateSpeechAPI(model, sentence) {
    const prediction = await callAPI(model, sentence);
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