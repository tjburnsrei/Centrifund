# Synthetic provider-check recording

`provider-note.wav` was generated locally with Windows speech synthesis. It contains no real contact or customer data:

> This is a synthetic test note. Casey Example is interested in financing a renovation in Richmond. The requested loan is three hundred thousand dollars. We agreed to call back on October fifth, twenty twenty six.

The opt-in `node scripts/verify-providers.mjs` check runs the app's real transcription and note-generation code against the configured OpenAI and DeepSeek services. Database and Storage responses are synthetic in-memory fixtures. The script replaces database settings with dummy values and blocks every network destination except the two exact AI endpoints. It never saves a contact or calls the production database/Storage. It prints statuses and validation results, not transcripts, summaries or keys. Normal builds and CI skip this check. To opt in for one protected Vercel deployment, set CALLING_VERIFY_PROVIDERS=1 for that deployment only; the postbuild hook then runs it. This incurs a small API usage charge. Do not add the opt-in flag to the shared project environment.
