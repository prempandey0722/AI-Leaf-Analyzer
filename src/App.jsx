import React, { useState, useCallback, useEffect } from "react";

// ------------------- API CONFIG -------------------
// Note: apiKey is left blank and is automatically provided by the Canvas environment.
const apiKey = ""; 
// FIX: Updated model to the latest Gemini 2.5 Flash for vision tasks.
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// Convert File → Base64
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
  });

// Smart Fetch with Retry (Exponential Backoff)
const fetchWithRetry = async (url, options, maxRetries = 4) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, options);

      if (!res.ok) {
        // Retry only for 429 rate limits
        if (res.status === 429 && i < maxRetries - 1) {
          const delay = 1000 * Math.pow(2, i);
          // console.log(`Rate limit hit, retrying in ${delay / 1000}s...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        // Throw for other HTTP errors (4xx, 5xx)
        throw new Error(`HTTP ${res.status}`);
      }

      return res;
    } catch (err) {
      if (i === maxRetries - 1) {
        // console.error("Max retries reached. Failing.");
        throw err;
      }
      // console.log(`Fetch failed, retrying (Attempt ${i + 2})...`);
      const delay = 800 * Math.pow(2, i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
};

// ------------------- MAIN APP -------------------
const App = () => {
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [analysis, setAnalysis] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [err, setErr] = useState("");

  // Handle image selection
  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setErr("");
    setAnalysis("");
    setImageFile(file);
    // Revoke old URL before creating a new one to prevent memory leaks
    if (imageUrl) URL.revokeObjectURL(imageUrl); 
    setImageUrl(URL.createObjectURL(file));
  };

  // Analyze leaf with Gemini
  const analyzeLeaf = useCallback(async () => {
    if (!imageFile) {
      setErr("Please upload a leaf image first.");
      return;
    }

    setIsLoading(true);
    setErr("");
    setAnalysis("");

    try {
      const base64 = await fileToBase64(imageFile);

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: "Analyze this leaf image and identify the plant species. Provide a detailed summary including the scientific name, common uses, and key traits. The output must be clearly structured and provided in English, followed by a full translation into Hindi, and finally a full translation into Spanish." },
              {
                inlineData: {
                  mimeType: imageFile.type,
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          systemInstruction:
            "You are an expert botanist and multilingual translator. Respond only with the requested structured analysis and translations. Do not include any introductory or concluding remarks.",
          temperature: 0.4,
        },
      };

      const response = await fetchWithRetry(GEMINI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      const text =
        result?.candidates?.[0]?.content?.parts?.[0]?.text || null;

      if (!text) {
        console.error("AI Response Structure:", result);
        setErr("AI did not return proper text. Check logs for API response structure.");
        return;
      }

      setAnalysis(text);
    } catch (error) {
      console.error("API Call Error:", error);
      setErr("Failed to analyze. Please check your API configuration or network connection.");
    } finally {
      setIsLoading(false);
    }
  }, [imageFile]);

  // Cleanup object URL
  useEffect(() => {
    // This effect cleans up the object URL when the component unmounts 
    // or when imageUrl changes (though handleImage now revokes it immediately).
    return () => imageUrl && URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 to-green-200 p-6 flex justify-center font-[Inter]">
      <div className="w-full max-w-4xl bg-white shadow-2xl rounded-3xl p-8 border border-green-300">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-green-700 drop-shadow-sm">
            🌿 AI Leaf Analyzer
          </h1>
          <p className="text-gray-600 mt-2">
            Identify plants instantly using the Gemini AI Vision model.
          </p>
        </header>

        {/* Upload Section */}
        <div className="border-2 border-dashed border-green-400 p-6 rounded-2xl text-center hover:bg-green-50 transition">
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex flex-col items-center">
              <span className="text-4xl text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-camera-icon h-10 w-10 mx-auto mb-2"><path d="M6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3H6z"/><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M14.5 4.5 16 6"/></svg>
              </span>
              <p className="mt-2 text-lg text-green-700 font-bold">
                Tap to Upload or Capture Leaf Image
              </p>
              <p className="text-sm text-gray-500">Supports JPG / PNG / Camera (mobile)</p>
            </div>
          </label>

          <input
            id="file-upload"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImage}
            className="hidden"
          />
        </div>

        {/* Preview + Button */}
        <div className="mt-8 flex flex-col md:flex-row gap-6">
          {/* Left */}
          <div className="md:w-1/2 space-y-4">
            <h2 className="text-xl font-semibold text-gray-700">Preview</h2>

            <div className="h-64 bg-gray-100 rounded-2xl border overflow-hidden flex justify-center items-center">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Uploaded leaf"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <p className="text-gray-500">No image selected.</p>
              )}
            </div>

            <button
              onClick={analyzeLeaf}
              disabled={!imageFile || isLoading}
              className={`w-full py-3 rounded-xl text-white font-bold shadow-lg transition duration-300
                ${
                  isLoading || !imageFile
                    ? "bg-green-300 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 hover:scale-[1.02] active:scale-[0.98]"
                }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                </div>
              ) : "Analyze Leaf with AI"}
            </button>

            {imageFile && (
              <button
                onClick={() => {
                  if (imageUrl) URL.revokeObjectURL(imageUrl);
                  setImageFile(null);
                  setImageUrl(null);
                  setAnalysis("");
                  setErr("");
                }}
                className="w-full py-2 rounded-xl bg-gray-200 hover:bg-gray-300 transition duration-300"
              >
                Reset
              </button>
            )}

            {err && (
              <div className="text-red-700 bg-red-100 border border-red-300 p-3 rounded-xl font-medium">
                {err}
              </div>
            )}
          </div>

          {/* Right */}
          <div className="md:w-1/2">
            <h2 className="text-xl font-semibold text-gray-700 mb-3">
              AI Analysis (English / Hindi / Spanish)
            </h2>

            <div className="bg-gray-50 border p-4 rounded-2xl h-[400px] overflow-y-auto shadow-inner whitespace-pre-wrap">
              {isLoading && !analysis ? (
                <p className="text-gray-500 italic flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Thinking like an expert botanist...
                </p>
              ) : analysis ? (
                <p className="text-gray-800 leading-relaxed">{analysis}</p>
              ) : (
                <p className="text-gray-500 italic">
                  Upload an image and run AI analysis to see results here. The analysis will include translations!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;