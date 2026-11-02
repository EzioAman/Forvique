import Header from '@/components/Header';
import MainSection from '@/components/MainSection';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="bg-white text-neutral-900 dark:bg-neutral-950 antialiased dark:text-neutral-100">
      <div style={{ fontFamily: 'Inter Variable, SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue, sans-serif' }}>
        <Header />
        <MainSection />
        <Footer />
      </div>
    </div>
  );
};

export default Index;
