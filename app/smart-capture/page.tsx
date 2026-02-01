import { SmartCamera } from "@/components/smart-capture/smart-camera";
import { redirect } from "next/navigation";

interface PageProps {
    searchParams: Promise<{
        session?: string;
    }>;
}

export default async function SmartCapturePage(props: PageProps) {
    const searchParams = await props.searchParams;

    if (!searchParams.session) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <p>Invalid Session. Scan the QR code again.</p>
            </div>
        );
    }

    return <SmartCamera sessionId={searchParams.session} />;
}
