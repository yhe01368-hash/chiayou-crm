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
  const [showTax, setShowTax] = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  const { data: shipment, isLoading } = useQuery({
    queryKey: ['shipment', id],
    queryFn: () => shipmentApi.getById(id!).then(res => res.data),
  });

  useEffect(() => {
    // 不要在頁面載入時自動列印，等待使用者選擇
  }, []);

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
      pdf.save('出貨單_' + (shipment?.shipment_number || id) + '.pdf');
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'print-orientation';
    style.innerHTML = '@page { size: 9.5in 5.5in portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const existing = document.getElementById('print-orientation');
      if (existing) existing.remove();
    }, 500);
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
    return rocYear + ' 年 ' + format(d, 'MM 月 dd 日', { locale: zhTW });
  };

  const formatCurrency = (amount: number) => '$' + Number(amount).toLocaleString();
  const items = shipment.items || [];
  const totalAmount = items.reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0);
  const taxAmount = Math.round(totalAmount * 0.05);

  const border = '1px solid #1a1a1a';

  return (
    <>
      <style>{`
        @page {
          size: 9.5in 5.5in portrait;
          margin: 0;
        }
        
        @media screen {
          .shipment-paper {
            width: 100% !important;
            max-width: 900px !important;
            min-height: calc(100vh - 150px) !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
            border-radius: 8px !important;
            margin: 0 auto !important;
            font-size: 14px !important;
            padding: 20px !important;
          }
          .no-print {
            position: sticky;
            top: 0;
            z-index: 100;
            background: white;
            padding: 1rem;
          }
        }
        
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
            width: 7.5in !important;
            transform: scale(1) !important;
            transform-origin: center top !important;
            font-size: 9.5pt !important;
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

      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet" />

      <div className="min-h-screen bg-gray-100 print:bg-white flex flex-col items-center pt-4">
        <div className="no-print flex gap-2 mb-4 sticky top-0 z-50 bg-white p-2 shadow-md">
          <Link to="/shipments" className="btn btn-secondary flex items-center gap-2">
            <ArrowLeft size={16} /> 返回列表
          </Link>
          <button onClick={() => setShowDialog(true)} className="btn btn-primary flex items-center gap-2">
            <Printer size={16} /> 列印
          </button>
          <button onClick={() => setShowDialog(true)} className="btn btn-secondary flex items-center gap-2">
            <Download size={16} /> 下載 PDF
          </button>
        </div>

        {/* 稅額選擇對話框 */}
        {showDialog && (
          <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4" style={{ position: 'relative', zIndex: 10000 }}>
              <h3 className="text-lg font-bold mb-4">選擇列印選項</h3>
              <p className="text-gray-600 mb-4">是否要列印稅額與總計？</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowTax(true);
                    setShowDialog(false);
                    setTimeout(() => handlePrint(), 100);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  是（含稅額）
                </button>
                <button
                  onClick={() => {
                    setShowTax(false);
                    setShowDialog(false);
                    setTimeout(() => handlePrint(), 100);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  否（不含金稅）
                </button>
              </div>
              <button
                onClick={() => setShowDialog(false)}
                className="mt-3 w-full text-center text-gray-500 hover:text-gray-700"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div ref={paperRef} className="shipment-paper" style={{
          width: '8in',
          backgroundColor: '#fff',
          padding: '6pt',
          boxSizing: 'border-box',
          fontFamily: '"Noto Sans CJK TC", "Microsoft JhengHei", sans-serif',
          fontSize: '9.5pt',
          color: '#1a1a1a',
          lineHeight: 1.3,
        }}>
          {/* 公司抬頭列 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3pt' }}>
            <div>
              <div style={{ fontSize: '11.5pt', fontWeight: 'bold', color: '#1a1a1a' }}>嘉祐資訊企業有限公司</div>
              <div style={{ fontSize: '8pt', color: '#444', lineHeight: 1.2 }}>台中市豐原區中正路 737 巷 23 弄 2 號</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2pt', fontSize: '8pt' }}>
              <div>電話：04-25279968 傳真：04-25279997</div>
              <div style={{ background: '#e0e0e0', color: '#1a1a1a', padding: '2pt 4pt', fontSize: '8pt', fontWeight: 'bold' }}>
                貨單號碼：{shipment.shipment_number}
              </div>
            </div>
          </div>

          {/* 頁面大標題 */}
          <div style={{ textAlign: 'center', fontSize: '14.7pt', fontWeight: 'bold', letterSpacing: '4pt', border: '1.5px solid #1a1a1a', padding: '3pt 0', marginBottom: '3pt' }}>
            出 貨 單
          </div>

          {/* 客戶資料區 - 兩列 */}
          <div style={{ border, padding: '3pt', marginBottom: '3pt' }}>
            {/* 第一列：客戶名稱 + 客戶地址 */}
            <div style={{ display: 'flex', gap: '2pt', fontSize: '9pt', lineHeight: 1.6, alignItems: 'center', justifyContent: 'space-between', marginBottom: '2pt' }}>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>客戶名稱：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 1, fontWeight: 'bold' }}>{shipment.customer?.name || '-'}</span>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>客戶地址：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 2, fontWeight: 'bold' }}>{shipment.customer?.address || '-'}</span>
            </div>
            {/* 第二列：電話、傳真、手機、統編、聯絡人 */}
            <div style={{ display: 'flex', gap: '2pt', fontSize: '9pt', lineHeight: 1.6, alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>電 話：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 1, fontWeight: 'bold' }}>{shipment.customer?.phone || '-'}</span>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>傳 真：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 1, fontWeight: 'bold' }}>{shipment.customer?.fax || '-'}</span>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>手 機：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 1, fontWeight: 'bold' }}>{shipment.customer?.phone2 || '-'}</span>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>統 編：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 1, fontWeight: 'bold' }}>{shipment.customer?.tax_id || '-'}</span>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>聯絡人：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 1, fontWeight: 'bold' }}>{shipment.customer?.contact || '-'}</span>
            </div>
          </div>

          {/* 商品明細 */}
          <div style={{ marginBottom: '3pt' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: '45%' }}>項目名稱</th>
                  <th style={{ ...th, width: '10%', textAlign: 'center' }}>數量</th>
                  <th style={{ ...th, width: '8%', textAlign: 'center' }}>單位</th>
                  <th style={{ ...th, width: '18%', textAlign: 'right' }}>單價</th>
                  <th style={{ ...th, width: '19%', textAlign: 'right' }}>金額</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
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
                {items.length < 5 && Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
                  <tr key={'e' + i}>
                    <td style={{ ...td, height: '14pt' }}></td>
                    <td style={{ ...td, height: '14pt', textAlign: 'center' }}></td>
                    <td style={{ ...td, height: '14pt', textAlign: 'center' }}></td>
                    <td style={{ ...td, height: '14pt', textAlign: 'right' }}></td>
                    <td style={{ ...td, height: '14pt', textAlign: 'right' }}></td>
                  </tr>
                ))}
                {/* 稅額與總計 */}
                {showTax && (
                  <>
                    <tr>
                      <td colSpan={3} style={{ ...td, textAlign: 'right', fontWeight: 'bold', paddingRight: '4pt' }}>稅額：</td>
                      <td style={td}></td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(taxAmount)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} style={{ ...td, textAlign: 'right', fontWeight: 'bold', paddingRight: '4pt' }}>總計：</td>
                      <td style={td}></td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(totalAmount + taxAmount)}</td>
                    </tr>
                  </>
                )}
                {!showTax && (
                  <tr>
                    <td colSpan={4} style={{ ...td, textAlign: 'right', fontWeight: 'bold', paddingRight: '4pt' }}>合計：</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(totalAmount)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 注意事項 */}
          <div style={{ border, padding: '3pt', marginBottom: '3pt', fontSize: '7.5pt', lineHeight: 1.3 }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1pt', fontSize: '8pt' }}>注意事項：</div>
            <div>1. 請注意客戶送修電腦其內裝所有軟體，有關版權問題一律與本公司無關，特此聲明！</div>
            <div>2. 如有需要安裝新軟體，請客戶自備版權軟體，或由本公司代購。</div>
            <div>3. 客戶取回之產品，三日內同問題應立即告知，逾期無效；不同原因之問題視為計費維修。</div>
            <div>4. 更換、修理之零件保證期限為壹個月。</div>
            <div>5. 客戶送修之產品若為故障品，本公司不負賠償之責任。</div>
          </div>

          {/* 簽收欄 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border }}>
            <div style={{ padding: '3pt', borderRight: '1px solid #1a1a1a' }}>
              <div style={{ fontWeight: 'bold', fontSize: '8pt', letterSpacing: '1pt' }}>工程師</div>
              <div style={{ borderBottom: '1px solid #1a1a1a', height: '14pt', marginTop: '1pt' }}></div>
            </div>
            <div style={{ padding: '3pt', borderRight: '1px solid #1a1a1a' }}>
              <div style={{ fontWeight: 'bold', fontSize: '8pt', letterSpacing: '1pt' }}>客戶簽名</div>
              <div style={{ borderBottom: '1px solid #1a1a1a', height: '14pt', marginTop: '1pt' }}></div>
            </div>
            <div style={{ padding: '3pt', display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '9pt', letterSpacing: '1pt', marginRight: '4pt' }}>日 期：</div>
              <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>{shipment.shipment_date ? formatRocDate(shipment.shipment_date) : ''}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const th: React.CSSProperties = {
  background: '#e5e5e5',
  color: '#1a1a1a',
  padding: '2pt 3pt',
  textAlign: 'left',
  fontSize: '9.5pt',
  letterSpacing: '0.5px',
  border: '1px solid #1a1a1a',
  fontWeight: 'bold',
};

const td: React.CSSProperties = {
  border: '1px solid #1a1a1a',
  padding: '2pt 3pt',
  verticalAlign: 'middle',
  lineHeight: 1.2,
};