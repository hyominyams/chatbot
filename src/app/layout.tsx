import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClassCoder",
  description: "학생을 위한 코드 튜터 챗봇",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
