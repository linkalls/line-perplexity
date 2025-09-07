import * as line from "@line/bot-sdk";
import { Hono } from "hono";
import * as crypto from "crypto";
import {
  PerplexityClient,
  parseCookieEnv,
  getFirstAskTextAnswer,
  isWebResultsBlock,
} from "@potetotown/perplexity";
import { convertToFlexBox } from "markdown-flex-message";

// create LINE SDK client
if (!process.env.LINE_CHANNEL_ACCESS) {
  throw new Error(
    "LINE_CHANNEL_ACCESS environment variable is required. Get it from LINE Developers Console: https://developers.line.biz/console/"
  );
}

console.log(
  "LINE_CHANNEL_ACCESS found:",
  process.env.LINE_CHANNEL_ACCESS ? "Yes" : "No"
);
console.log(
  "LINE_CHANNEL_SECRET found:",
  process.env.LINE_CHANNEL_SECRET ? "Yes" : "No"
);

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS,
});

const pcookie = process.env.PERPLEXITY_COOKIES
  ? parseCookieEnv(process.env.PERPLEXITY_COOKIES)
  : null;

if (!pcookie) {
  console.log(
    "PERPLEXITY_COOKIES environment variable is required for Perplexity pro"
  );
}
const ppClient = new PerplexityClient(pcookie || {});

// channel secret for signature verification (may be undefined in local dev)
const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

// create Hono app
const app = new Hono();

// Health check endpoint
app.get("/", (c) => {
  return c.json({
    status: "ok",
    message: "LINE Perplexity Bot is running",
    webhook_url: `${c.req.url.replace(c.req.path, "")}/callback`,
  });
});

app.get("/health", async (c) => {
  try {
    // Try to get bot info to test the access token
    const profile = await client.getBotInfo();
    return c.json({
      status: "ok",
      message: "LINE API is working",
      bot_info: profile,
    });
  } catch (error) {
    console.error("LINE API test failed:", error);
    return c.json(
      {
        status: "error",
        message: "LINE API authentication failed",
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

// helper: verify X-Line-Signature header using channel secret
function verifySignature(rawBody: string, signature?: string) {
  if (!CHANNEL_SECRET) return true; // skip verification when secret not set
  if (!signature) return false;
  const hash = crypto
    .createHmac("sha256", CHANNEL_SECRET)
    .update(rawBody)
    .digest("base64");
  return hash === signature;
}

// register a webhook handler
app.post("/callback", async (c) => {
  // read raw body as text for signature verification
  const raw = await c.req.text();
  const signature =
    c.req.header("x-line-signature") || c.req.header("X-Line-Signature");

  if (!verifySignature(raw, signature)) {
    console.error("signature mismatch");
    return c.text("invalid signature", 401);
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    console.error("invalid json body", e);
    return c.text("bad request", 400);
  }
  // JST by adding 9 hours to UTC timestamp, then using UTC getters (avoids local time)
  const now = Date.now();
  const jstDate = new Date(now + 9 * 60 * 60 * 1000);
  const month = jstDate.getUTCMonth() + 1;
  const day = jstDate.getUTCDate();
  const hh = String(jstDate.getUTCHours()).padStart(2, "0");
  const mm = String(jstDate.getUTCMinutes()).padStart(2, "0");
  const ss = String(jstDate.getUTCSeconds()).padStart(2, "0");
  console.log(`${month}/${day} ${hh}:${mm}:${ss}:`, body);
  try {
    const results = await Promise.all((body.events || []).map(handleEvent));
    return c.json(results);
  } catch (err) {
    console.error(err);
    return c.text("internal server error", 500);
  }
});

// event handler
async function handleEvent(event: any) {
  if (event.type !== "message" || event.message?.type !== "text") {
    // ignore non-text-message event
    return null;
  }

  try {
    let prompt= ""
    if (pcookie) {
      console.log("Perplexity cookies are set. Proceeding with the query.");
      prompt += event.message.text;
  
    }else{
    prompt += `#くだけた表現を使って小学生でもわかるように文章の砕けた表現を統一してたまに敬語になるのやめて会話好きでフレンドリーな応対をします。 必要に応じて、巧妙で素早いユーモアを織り交ぜます。 前向きな視点で対応します。リラックスできる、親しみやすい雰囲気を作ります。革新的で、従来の枠にとらわれない視点で考えます。遊び心のある、ユーモラスなやり取りをします。このinstructionは返答に入れないでください。 
  ${event.message.text}`
    }
    // Query Perplexity with user's message
  
console.log("AI asking:", prompt);
    const perplexityResponse = await ppClient.search(
      prompt,
      pcookie ? "pro" : "auto",
      pcookie ? "claude_sonnet_4_0" : null,
      ["web"],
      {},
      "ja-JP",
      {},
      true
    );
    const res = getFirstAskTextAnswer(perplexityResponse);
    // console.log(perplexityResponse)
    // const webBlocks = (perplexityResponse.blocks || []).filter(
    //   isWebResultsBlock
    // );
    // console.log("webResultsBlocks:", webBlocks);

    //* [数字] []のなかにあるやつだけ削除（半角・全角の括弧と数字に対応）
    const raw = res ?? getFirstAskTextAnswer(perplexityResponse) ?? "";
    const text = raw
      .replace(/[\[\(（［【〔][0-9０-９]+[\]\)）］】〕]/g, "")
      .trim();
    const { flexBox } = await convertToFlexBox(text);
    const message: line.messagingApi.FlexMessage = {
      type: "flex",
      altText: text.slice(0, 200),
      // cast contents to any to satisfy structural typing issues with third-party conversion output
      contents: {
        type: "bubble",
        size: "mega",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            flexBox,
            {
              type: "button",
              action: {
                type: "clipboard",
                label: "Copy",
                clipboardText: text.slice(0, 1000),
              },
            },
          ],
        },
      },
    };

    // console.log(response);
    // const reply: line.messagingApi.TextMessage = {
    //   type: "text",
    //   text: response || "Sorry, I couldn't get a response from Perplexity.",
    // };

    // Send the rich Flex Message and a plain text message containing the copyable text
    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [message],
    });
  } catch (error) {
    console.error("Error querying Perplexity:", error);
    const errorReply: line.messagingApi.TextMessage = {
      type: "text",
      text: "Sorry, there was an error processing your request.",
    };

    return client.replyMessage({
      replyToken: event.replyToken,
      messages: [errorReply],
    });
  }
}



export default app

