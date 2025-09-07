import {
  PerplexityClient,
  getFirstAskTextAnswer,
  parseCookieEnv,
} from "@potetotown/perplexity";
const ppClient = new PerplexityClient(
  parseCookieEnv(process.env.PERPLEXITY_COOKIES)
);
const perplexityResponse = await ppClient.search(
  "a",
  "pro",
  "gpt5",
  ["web"],
  {},
  "ja-JP",
  {},
  true
);
const res = getFirstAskTextAnswer(perplexityResponse);
