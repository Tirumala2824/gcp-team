import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Gemini Reflection Journal',
  description: 'User-authenticated personal reflection and journaling application powered by Gemini 3.6 Flash and Cloud Firestore with complete per-user data isolation.',
  openGraph: {
    title: 'Gemini Reflection Journal',
    description: 'User-authenticated personal reflection and journaling application powered by Gemini 3.6 Flash and Cloud Firestore with complete per-user data isolation.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gemini Reflection Journal',
    description: 'User-authenticated personal reflection and journaling application powered by Gemini 3.6 Flash and Cloud Firestore with complete per-user data isolation.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
