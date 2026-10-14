import './globals.css';

export const metadata = {
  title: 'WebDND — Modern Tabletop VTT',
  description: 'Gelişmiş D&D 5e ve BG3 esintili Masaüstü Rol Yapma ve Harita Yönetim Platformu',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="bg-dnd-deepest text-dnd-parchmentLight min-h-screen selection:bg-gold-500/30 selection:text-gold-300">
        {children}
      </body>
    </html>
  );
}
