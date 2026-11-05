import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // Test GPA calculate endpoint
  const calculateRes = http.post(
    'http://localhost:8000/api/gpa/calculate',
    JSON.stringify({}),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(calculateRes, {
    'calculate status is 200': (r) => r.status === 200,
    'calculate has CPA': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.cpa === 'number';
      } catch {
        return false;
      }
    },
  });

  // Test forecast endpoint
  const forecastRes = http.post(
    'http://localhost:8000/api/gpa/forecast',
    JSON.stringify({ targetCpa: 3.5, additionalCredits: 30 }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(forecastRes, {
    'forecast status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
