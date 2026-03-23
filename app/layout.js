export const metadata = {
  title: "ExpenseBot — TaleNest Tools",
  description: "AI-powered expense management for TaleNest",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: "#0F1117" }}>
        {children}
      </body>
    </html>
  );
}
