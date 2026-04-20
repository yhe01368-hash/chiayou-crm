import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { shipmentApi } from '../services/api';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function ShipmentPrint() {
 const { id } = useParams();
 const paperRef = useRef<HTMLDivElement>(null);
 const [downloading, setDownloading] = useState(false);

 const { data: shipment, isLoading } = useQuery({
 queryKey: ['shipment', id],
 queryFn: () => shipmentApi.getById(id!).then(res => res.data),
 });

 useEffect(() => {
 if (shipment) {
 const timer = setTimeout(() => window.print(), 300);
 return () => clearTimeout(timer);
 }
 }, [shipment]);

 const handleDownloadPDF = async () => {
 if (!paperRef.current) return;
 setDownloading(true);
 try {
 const PAPER_W_PX = Math.round(8.5 * 96);
 const PAPER_H_PX = Math.round(5.5 * 96);
 const canvas = await html2canvas(paperRef.current, {
 scale: 1,
 useCORS: true,
 backgroundColor: '#ffffff',
 logging: false,
 width: PAPER_W_PX,
 height: PAPER_H_PX,
 });
 const canvasRotated = document.createElement('canvas');
 canvasRotated.width = canvas.height;
 canvasRotated.height = canvas.width;
 const ctx = canvasRotated.getContext('2d')!;
 ctx.translate(0, canvas.width);
 ctx.rotate(-Math.PI / 2);
 ctx.drawImage(canvas, 0, 0);
 const imgData = canvasRotated.toDataURL('image/png');
 const pdfW = 612;
 const pdfH = 396;
 const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [pdfW, pdfH] });
 pdf.addImage(imgData, 'PNG', 0, 0, 528, 612);
 pdf.save(`出貨單_${shipment?.shipment_number || id}.pdf`);
 } catch (err) {
 console.error('PDF generation failed:', err);
 } finally {
 setDownloading(false);
 }
 };

 if (isLoading) {
 return (
 <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
 <div className="text-gray-500">載入中...</div>
 </div>
 );
 }

 if (!shipment) {
 return (
 <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
 <div className="text-gray-500 mb-4">找不到出貨單</div>
 <Link to="/shipments" className="btn btn-secondary">返回列表</Link>
 </div>
 );
 }

 const formatRocDate = (dateStr: string) => {
 if (!dateStr) return '';
 const d = new Date(dateStr);
 const rocYear = d.getFullYear() - 1911;
 return `${rocYear} 年 ${format(d, 'MM 月 dd 日', { locale: zhTW })}`;
 };

 const formatCurrency = (amount: number) => '$' + Number(amount).toLocaleString();
 const items = shipment.items || [];
 const totalAmount = items.reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0);

 const border = '1px solid #1a1a1a';
 const LP = '1.2';

 return (
 <>
 <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet" />
 
 <style>{`
 @page {
 size: 9.5in 5.5in landscape;
 margin: 0;
 }
 
 /* 預覽時讓紙張放大充滿視窗 */
 @media screen {
 .shipment-paper {
 width: 100% !important;
 max-width: 950px !important;
 min-height: calc(100vh - 150px) !important;
 transform: none !important;
 box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
 border-radius: 8px !important;
 margin: 0 auto !important;
 font-size: 14px !important;
 padding: 15px !important;
 }
 .no-print {
 position: sticky;
 top: 0;
 z-index: 100;
 background: white;
 padding: 1rem;
 }
 }
 
 /* 列印時 */
 @media print {
 html, body {
 margin: 0 !important;
 padding: 0 !important;
 width: 100% !important;
 height: 100% !important;
 background: #fff !important;
 overflow: hidden !important;
 }
 .no-print {
 display: none !important;
 }
 .shipment-paper {
 width: 9.3in !important;
 max-width: 9.3in !important;
 font-size: 9pt !important;
 padding: 6pt !important;
 margin: 0 auto !important;
 }
 * {
 box-sizing: border-box !important;
 }
 -webkit-print-color-adjust: exact;
 print-color-adjust: exact;
 }
 `}</style>
 * {
 box-sizing: border-box !important;
 }
 -webkit-print-color-adjust: exact;
 print-color-adjust: exact;
 }
 `}</style>

 <div className="min-h-screen bg-gray-100 print:bg-white flex flex-col items-center pt-4">

 {/* 控制列（不列印） */}
 <div className="no-print flex gap-2 mb-4 sticky top-0 z-50 bg-white p-2 shadow-md">
 <Link to="/shipments" className="btn btn-secondary flex items-center gap-2">
 <ArrowLeft size={16} /> 返回列表
 </Link>
 <button onClick={() => window.print()} className="btn btn-primary flex items-center gap-2">
 <Printer size={16} /> 列印
 </button>
 <button onClick={handleDownloadPDF} disabled={downloading} className="btn btn-secondary flex items-center gap-2">
 <Download size={16} />
 {downloading ? '生成中...' : '下載 PDF'}
 </button>
 </div>

 {/* 可列印紙張本體 */}
 <div
 ref={paperRef}
 className="shipment-paper"
 style={{
 width: '9.3in',
 backgroundColor: '#fff',
 padding: '10px 12px',
 boxSizing: 'border-box',
 fontFamily: '"Noto Sans CJK TC", "Microsoft JhengHei", "Heiti TC", sans-serif',
 fontSize: '9pt',
 color: '#1a1a1a',
 lineHeight: LP,
 }}
 >
 {/* 公司抬頭列 */}
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
 <div>
 <div style={{ fontSize: '11pt', fontWeight: 'bold', color: '#1a1a1a' }}>嘉祐資訊企業有限公司</div>
 <div style={{ fontSize: '9pt', color: '#444', lineHeight: 1.3 }}>台中市豐原區中正路 737 巷 23 弄 2 號</div>
 </div>
 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', fontSize: '9pt' }}>
 <div>電話：04-25279968 傳真：04-25279997</div>
 <div style={{ background: '#1a1a1a', color: '#fff', padding: '3px 8px', fontSize: '9pt', fontWeight: 'bold', letterSpacing: '0.5px' }}>
 貨單號碼：{shipment.shipment_number}
 </div>
 </div>
 </div>

 {/* 頁面大標題 */}
 <div style={{ textAlign: 'center', fontSize: '14pt', fontWeight: 'bold', letterSpacing: '5px', border: '2px solid #1a1a1a', padding: '4px 0', marginBottom: '6px' }}>
 出 貨 單
 </div>

 {/* 客戶資料區 */}
 <div style={{ border, padding: '4px 6px', marginBottom: '6px' }}>
 <div style={{ display: 'flex', gap: '4px', fontSize: '9pt', lineHeight: 1.8, alignItems: 'center', flexWrap: 'wrap' }}>
 <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>客戶名稱：</span>
 <span style={{ borderBottom: '1px dotted #aaa', minWidth: '100px', paddingRight: '4px' }}>{shipment.customer?.name || '-'}</span>
 <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>客戶地址：</span>
 <span style={{ borderBottom: '1px dotted #aaa', flex: 1 }}>{shipment.customer?.address || '-'}</span>
 </div>
 <div style={{ display: 'flex', gap: '4px', fontSize: '9pt', lineHeight: 1.8, alignItems: 'center', flexWrap: 'wrap' }}>
 <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>電 話：</span>
 <span style={{ borderBottom: '1px dotted #aaa', minWidth: '90px' }}>{shipment.customer?.phone || '-'}</span>
 <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>傳 真：</span>
 <span style={{ borderBottom: '1px dotted #aaa', minWidth: '70px' }}>{shipment.customer?.fax || '-'}</span>
 <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>手 機：</span>
 <span style={{ borderBottom: '1px dotted #aaa', minWidth: '100px' }}>{shipment.customer?.phone2 || '-'}</span>
 <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>統 編：</span>
 <span style={{ borderBottom: '1px dotted #aaa', minWidth: '80px' }}>{shipment.customer?.tax_id || '-'}</span>
 <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>聯絡人：</span>
 <span style={{ borderBottom: '1px dotted #aaa', minWidth: '80px' }}>{shipment.customer?.contact || '-'}</span>
 <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>日 期：</span>
 <span style={{ borderBottom: '1px dotted #aaa', flex: 1 }}>{shipment.shipment_date ? formatRocDate(shipment.shipment_date) : '-'}</span>
 </div>
 </div>

 {/* 收費標準 */}
 <div style={{ border, padding: '4px 6px', marginBottom: '6px' }}>
 <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '9pt' }}>收費標準：</div>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 12px', fontSize: '8pt', lineHeight: 1.5 }}>
 <span>□ 診斷檢測費——免費</span>
 <span>□ 車馬費——300元</span>
 <span>□ 系統重灌——800元</span>
 <span>□ 硬體安裝（單項）——300元</span>
 <span>□ 軟體設定、調整——300元</span>
 <span>□ 網路架設（材料另計）——1000元</span>
 </div>
 </div>

 {/* 商品明細 */}
 <div style={{ marginBottom: '6px' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
 <thead><tr>
 <th style={th}>項 目 名 稱</th>
 <th style={{ ...th, width: '7%', textAlign: 'center' }}>數量</th>
 <th style={{ ...th, width: '6%', textAlign: 'center' }}>單位</th>
 <th style={{ ...th, width: '15%', textAlign: 'right' }}>單 價</th>
 <th style={{ ...th, width: '16%', textAlign: 'right' }}>金 額</th>
 </tr>
 </thead>
 <tbody>
 {items.length === 0 ? (
 Array.from({ length: 3 }).map((_, i) => (
 <tr key={i}>
 <td style={td}></td>
 <td style={{ ...td, textAlign: 'center' }}></td>
 <td style={{ ...td, textAlign: 'center' }}></td>
 <td style={{ ...td, textAlign: 'right' }}></td>
 <td style={{ ...td, textAlign: 'right' }}></td>
 </tr>
 ))
 ) : (
 items.map((item: any, idx: number) => (
 <tr key={item.id || idx}>
 <td style={td}>{item.product_name || item.product_id}</td>
 <td style={{ ...td, textAlign: 'center' }}>{item.quantity}</td>
 <td style={{ ...td, textAlign: 'center' }}>組</td>
 <td style={{ ...td, textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
 <td style={{ ...td, textAlign: 'right' }}>{formatCurrency(item.subtotal)}</td>
 </tr>
 ))
 )}
 {items.length < 4 && Array.from({ length: Math.max(0, 4 - items.length - 1) }).map((_, i) => (
 <tr key={`e${i}`}>
 <td style={{ ...td, height: '14px' }}></td>
 <td style={{ ...td, height: '14px', textAlign: 'center' }}></td>
 <td style={{ ...td, height: '14px', textAlign: 'center' }}></td>
 <td style={{ ...td, height: '14px', textAlign: 'right' }}></td>
 <td style={{ ...td, height: '14px', textAlign: 'right' }}></td>
 </tr>
 ))}
 <tr>
 <td colSpan={3} style={{ ...td, fontWeight: 'bold', textAlign: 'right', paddingRight: '4px' }}>合計：</td>
 <td style={td}></td>
 <td style={{ ...td, textAlign: 'right', fontWeight: 'bold', fontSize: '10pt' }}>{formatCurrency(totalAmount)}</td>
 </tr>
 </tbody>
 </table>
 </div>

 {/* 備註（玉山銀行） */}
 <div style={{ border, padding: '4px 6px', marginBottom: '6px' }}>
 <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '9pt' }}>備 註：</div>
 <div style={{ fontSize: '8pt', lineHeight: 1.4 }}>
 玉山銀行（銀行代號 808） 分行別：豐原分行 帳號：0381440003611 戶名：嘉祐資訊企業有限公司
 </div>
 {shipment.note && (
 <div style={{ fontSize: '8pt', marginTop: '2px', lineHeight: 1.4, color: '#444' }} dangerouslySetInnerHTML={{ __html: shipment.note }} />
 )}
 </div>

 {/* 注意事項 */}
 <div style={{ border, padding: '4px 6px', marginBottom: '6px', fontSize: '8pt', lineHeight: 1.5 }}>
 <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '9pt' }}>注意事項：</div>
 <div>1. 請注意客戶送修電腦其內裝所有軟體，有關版權問題一律與本公司無關，特此聲明！</div>
 <div>2. 如有需要安裝新軟體，請客戶自備版權軟體，或由本公司代購。</div>
 <div>3. 客戶取回之產品，三日內同問題應立即告知，逾期無效；不同原因之問題視為計費維修。</div>
 <div>4. 更換、修理之零件保證期限為壹個月。</div>
 <div>5. 客戶送修之產品若為故障品，本公司不負賠償之責任。</div>
 </div>

 {/* 簽收欄 */}
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border }}>
 <div style={{ padding: '4px 6px', borderRight: '1px solid #1a1a1a' }}>
 <div style={{ fontWeight: 'bold', fontSize: '9pt', letterSpacing: '2px' }}>工程師</div>
 <div style={{ borderBottom: '1px solid #1a1a1a', height: '14px', marginTop: '2px' }}></div>
 </div>
 <div style={{ padding: '4px 6px', borderRight: '1px solid #1a1a1a' }}>
 <div style={{ fontWeight: 'bold', fontSize: '9pt', letterSpacing: '2px' }}>客戶簽名</div>
 <div style={{ borderBottom: '1px solid #1a1a1a', height: '14px', marginTop: '2px' }}></div>
 </div>
 <div style={{ padding: '4px 6px' }}>
 <div style={{ fontWeight: 'bold', fontSize: '9pt', letterSpacing: '2px' }}>日 期</div>
 <div style={{ borderBottom: '1px solid #1a1a1a', height: '14px', marginTop: '2px' }}></div>
 </div>
 </div>
 </div>

 </div>
 </>
 );
}

const th: React.CSSProperties = {
 background: '#1a1a1a',
 color: '#fff',
 padding: '3px 5px',
 textAlign: 'left',
 fontSize: '9pt',
 letterSpacing: '0.5px',
 border: '1px solid #1a1a1a',
 fontWeight: 'bold',
};

const td: React.CSSProperties = {
 border: '1px solid #1a1a1a',
 padding: '3px 5px',
 verticalAlign: 'middle',
 lineHeight: 1.25,
};

