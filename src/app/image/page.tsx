"use client";

import TopNav from "@/components/TopNav";
import ImageStudio from "@/components/image/ImageStudio";

export default function ImagePage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 antialiased">
      <TopNav />
      <ImageStudio />
    </div>
  );
}
