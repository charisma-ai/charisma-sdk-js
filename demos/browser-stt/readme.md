# Demo for Web Speech API SpeechRecognition
NOTE: This demo is not supported in some browsers. https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition#browser_compatibility

## Setup
```
pnpm install
```

Add a `.env` file to the root of the project with the following:
```
VITE_STORY_API_KEY=your-story-api-key
```

## Run Locally
```
pnpm run dev
```

Note: The STT demo uses this local version of the SDK (`"link:.."` in package.json). If you make changes to the SDK, you'll need to build the SDK again:
```
cd ../
pnpm run build
```
