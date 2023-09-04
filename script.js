import { config } from "dotenv";
import { Configuration, OpenAIApi } from "openai";
import readline from "readline";
import fs from "fs";
import { promisify } from "util";

config();

const openAi = createOpenAIApi(process.env.OPEN_AI_API_KEY);
const userInterface = createReadlineInterface();
const currentDate = new Date().toISOString().split("T")[0];
const HISTORY_DIR = "history";
const HISTORY_FILE_PATH = `${HISTORY_DIR}/${currentDate}.json`;

let inMemoryHistory = [];
let conversationHistory = [];

function createOpenAIApi(apiKey) {
  return new OpenAIApi(new Configuration({ apiKey }));
}

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function initializeHistory() {
  try {
    inMemoryHistory = JSON.parse(
      await promisify(fs.readFile)(HISTORY_FILE_PATH, "utf-8")
    );
  } catch (err) {
    if (err.code === "ENOENT") inMemoryHistory = [];
    else throw err;
  }
}

async function ensureHistoryDirectoryExists() {
  if (!fs.existsSync(HISTORY_DIR)) {
    await promisify(fs.mkdir)(HISTORY_DIR);
  }
}

async function saveToHistory() {
  await promisify(fs.writeFile)(
    HISTORY_FILE_PATH,
    JSON.stringify(inMemoryHistory, null, 2),
    "utf-8"
  );
}

async function getOpenAIResponse(input) {
  const response = await openAi.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [...conversationHistory, { role: "user", content: input }],
  });
  return {
    output: response.data.choices[0].message.content,
    usage: response.data.usage,
  };
}

userInterface.on("line", async (input) => {
  try {
    process.stdout.write("Loading...");
    const { output, usage } = await getOpenAIResponse(input);
    process.stdout.clearLine(); // Clear the current line
    process.stdout.cursorTo(0); // Move the cursor to the beginning of the line
    console.log(output);
    console.log(usage);

    inMemoryHistory.push({ input, output, usage });

    conversationHistory.push({ role: "user", content: input });
    conversationHistory.push({ role: "assistant", content: output });
    await saveToHistory();

    userInterface.prompt();
  } catch (err) {
    console.error("An error occurred:", err);
    userInterface.prompt();
  }
});

async function initializeApplication() {
  await ensureHistoryDirectoryExists();
  await initializeHistory();
  userInterface.prompt();
}

initializeApplication();
