import MarketingCanvasRenderer from "@/components/marketing/MarketingCanvasRenderer";
import AmbientMusic from "@/components/AmbientMusic";

export default function ContactoPage() {
    return (
        <main className="w-full min-h-screen pb-20" style={{ background: 'rgb(var(--background-rgb))' }}>
            <AmbientMusic />
            <MarketingCanvasRenderer pageId="contacto" />
        </main>
    );
}
