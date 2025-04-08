import sys
import json
from youtube_transcript_api import YouTubeTranscriptApi
from langdetect import detect

# Transliteration for Hindi to Hinglish
from indic_transliteration.sanscript import transliterate
from indic_transliteration import sanscript

# Read video ID from command line
if len(sys.argv) < 2:
    print(json.dumps({"error": "No video ID provided"}))
    sys.exit(1)

video_id = sys.argv[1]

try:
    # Try English transcript first
    transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])
    language = 'en'
except Exception as e:
    try:
        # Try Hindi if English fails
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['hi'])
        language = 'hi'
    except Exception as e:
        print(json.dumps({
            "error": "Transcript not available",
            "message": str(e)
        }))
        sys.exit(0)

# Combine full transcript
full_text = " ".join([entry['text'] for entry in transcript])

# Detect actual language from the text
try:
    detected_lang = detect(full_text)
except Exception as e:
    print(json.dumps({"error": "Language detection failed"}))
    sys.exit(1)

# If Hindi, transliterate to Hinglish
if detected_lang == "hi":
    try:
        hinglish_text = transliterate(full_text, sanscript.DEVANAGARI, sanscript.ITRANS)
        full_text = hinglish_text
    except Exception as e:
        print(json.dumps({"error": f"Hinglish conversion failed: {str(e)}"}))
        sys.exit(1)

# Return final JSON
print(json.dumps({
    "language": detected_lang,
    "text": full_text
}))
