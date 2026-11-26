import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// Realistic 10,000-VU load test for Round 2 Coding Round
// Usage:
//   k6 run -e BASE_URL=https://staging.example.com -e EXAM_ID=1 -e QUESTION_ID=q1 -e TOKEN=<jwt> scripts/k6_coding_10k.js

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8000";
const EXAM_ID = Number(__ENV.EXAM_ID || 1);
const QUESTION_ID = __ENV.QUESTION_ID || "q1";
const CANDIDATE_TOKEN = __ENV.TOKEN || "";

const rateLimited429 = new Counter("coding_429_backpressure");
const serverErrors5xx = new Rate("coding_5xx_errors");
const submitLatency = new Trend("coding_submit_duration_ms");

export const options = {
  stages: [
    { duration: "2m", target: 2000 },
    { duration: "3m", target: 5000 },
    { duration: "4m", target: 10000 }, // Peak 10,000 concurrent virtual users
    { duration: "3m", target: 10000 }, // Sustained peak + submit bursts
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1500"],
    coding_5xx_errors: ["rate<0.01"],
  },
};

export default function () {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${CANDIDATE_TOKEN}`,
  };

  const roll = Math.random();

  if (roll < 0.7) {
    // 70% idle / reading problem statement (cached)
    const res = http.get(`${BASE_URL}/api/coding/problems/${QUESTION_ID}`, { headers });
    serverErrors5xx.add(res.status >= 500);
    check(res, { "problem status 200": (r) => r.status === 200 });
    sleep(Math.random() * 5 + 3);
  } else if (roll < 0.9) {
    // 20% running sample tests
    const payload = JSON.stringify({
      examId: EXAM_ID,
      questionId: QUESTION_ID,
      language: "python3",
      code: "print('hello')",
      idempotencyKey: `k6-run-${__VU}-${__ITER}`,
    });
    const res = http.post(`${BASE_URL}/api/coding/run`, payload, { headers });
    serverErrors5xx.add(res.status >= 500);
    if (res.status === 429) rateLimited429.add(1);
    check(res, { "run 202 or 429": (r) => r.status === 202 || r.status === 429 });
    sleep(Math.random() * 3 + 2);
  } else {
    // 10% submitting full solution
    const payload = JSON.stringify({
      examId: EXAM_ID,
      questionId: QUESTION_ID,
      language: "python3",
      code: "print('hello')",
      idempotencyKey: `k6-sub-${__VU}-${__ITER}`,
    });
    const t0 = Date.now();
    const res = http.post(`${BASE_URL}/api/coding/submit`, payload, { headers });
    submitLatency.add(Date.now() - t0);
    serverErrors5xx.add(res.status >= 500);
    if (res.status === 429) rateLimited429.add(1);
    check(res, { "submit 202 or 429": (r) => r.status === 202 || r.status === 429 });
    sleep(Math.random() * 4 + 2);
  }
}
