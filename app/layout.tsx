import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "求职投递台", description: "本地优先的企业与岗位投递管理工具" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
