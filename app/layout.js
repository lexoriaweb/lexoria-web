export const metadata = {
  title: 'LEXORIA',
  description: 'Law firm',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
