import MarketingCanvasRenderer from "@/components/marketing/MarketingCanvasRenderer";
import AmbientMusic from "@/components/AmbientMusic";

export default function CatalogIndexPage() {
    return (
        <main className="w-full bg-[#F5F5F5] pb-20">
            <AmbientMusic />
            <MarketingCanvasRenderer pageId="catalogo" />
        </main>
    );
}
