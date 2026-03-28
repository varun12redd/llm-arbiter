export async function askLLM(prompt, mode = "analysis") {
  const res = await fetch("http://127.0.0.1:8000/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, mode }),
  });

  if (!res.ok) {
    throw new Error("API request failed");
  }

  return res.json();
}