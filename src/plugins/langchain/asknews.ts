const API_URL = "http://localhost:3001/api/asknews/search";

export async function fetchNewsContext(text: string) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: text
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch news: ${response.statusText}`);
  }

  return response.json();
}
