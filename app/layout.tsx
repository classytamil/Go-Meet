import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Go Meet | Responsive Video Conferencing',
  description: 'A sophisticated online meeting web application.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}