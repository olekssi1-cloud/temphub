export async function GET() {
  return new Response(
    `
    <!DOCTYPE html>
    <html lang="uk">
      <head>
        <meta charset="UTF-8" />
        <title>Тест</title>
      </head>
      <body style="font-family: Arial; padding: 40px;">
        <h1>Привіт, мешканці 👋</h1>
        <p>API route працює.</p>
      </body>
    </html>
    `,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );
}