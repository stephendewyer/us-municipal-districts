export async function downloadJSON(
  url: string
): Promise<unknown> {

  const response =
    await fetch(url, {
      headers: {
        "User-Agent":
          "us-municipal-districts-data-generator/0.1"
      }
    });

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}: ${url}`
    );
  }

  return response.json();
}