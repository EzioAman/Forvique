import Header from './components/header';
import MainSection from './components/main-section';
import Footer from './components/footer';

export const metadata = {
  title: 'AI Platform — Forvique',
  description: 'AI agents that actually do the job. Intelligent command center.',
};

export default function AIPage() {
  return (
    <div className="bg-white text-neutral-900 dark:bg-neutral-950 antialiased dark:text-neutral-100 min-h-screen flex flex-col justify-between">
      <div style={{ fontFamily: 'Inter Variable, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif' }}>
        <Header />
        <MainSection />
        <Footer />
      </div>
    </div>
  );
}


