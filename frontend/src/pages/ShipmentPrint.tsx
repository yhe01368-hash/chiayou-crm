import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { shipmentApi } from '../services/api';
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect } from 'react';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export default function ShipmentPrint() {
  const { id } = useParams();

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

  const formatCurrency = (amount: number) =>
    '$' + Number(amount).toLocaleString();

  const items = shipment.items || [];
  const totalAmount = items.reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0);
  const totalQty = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white flex flex-col items-center pt-4">
      {/* Non-print controls */}
      <div className="no-print flex gap-2 mb-4">
        <Link to="/shipments" className="btn btn-secondary flex items-center gap-2">
          <ArrowLeft size={16} /> 返回列表
        </Link>
        <button onClick={() => window.print()} className="btn btn-primary flex items-center gap-2">
          <Printer size={16} /> 列印
        </button>
      </div>

      {/* Printable wrapper — scale container */}
      <div className="print-scale-wrapper">
        {/* ── Printable paper (8.5" x 5.5") ── */}
        <div
          className="print-paper"
          style={{
            width: '8.5in',
            backgroundColor: '#fff',
            padding: '0.09in 0.14in',
            boxSizing: 'border-box',
            fontFamily: '"Noto Sans CJK TC","Microsoft JhengHei","Heiti TC",sans-serif',
            fontSize: '7.5px',
            color: '#1a1a1a',
            lineHeight: 1.3,
          }}
        >
          {/* ── 公司列 ── */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1px',
            fontSize: '7px',
            color: '#444',
            lineHeight: 1.3,
          }}>
            <div>
              <div style={{ fontSize: '8.5px', fontWeight: 'bold', color: '#1a1a1a' }}>嘉祐資訊企業有限公司</div>
              <div>台中市豐原區中正路 737 巷 23 弄 2 號　電話：04-25279968　傳真：04-25279997</div>
            </div>
            <div style={{
              background: '#1a1a1a',
              color: '#fff',
              padding: '1px 4px',
              fontSize: '7px',
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              marginTop: '1px',
            }}>
              貨單號碼：{shipment.shipment_number}
            </div>
          </div>

          {/* ── 頁面標題 ── */}
          <div style={{
            textAlign: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            letterSpacing: '4px',
            border: '1.5px solid #1a1a1a',
            padding: '1px 0',
            marginBottom: '1px',
          }}>
            出　貨　單
          </div>

          {/* ── 客戶資料 ── */}
          <div style={{ border: '1px solid #1a1a1a', padding: '1px 3px', marginBottom: '1px' }}>
            <div style={{ display: 'flex', gap: '3px', fontSize: '7px', lineHeight: 1.6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>客戶名稱：</span>
              <span style={{ borderBottom: '1px dotted #aaa', minWidth: '90px' }}>{shipment.customer?.name || '-'}</span>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>客戶地址：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 1 }}>{shipment.customer?.address || '-'}</span>
            </div>
            <div style={{ display: 'flex', gap: '3px', fontSize: '7px', lineHeight: 1.6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>電　話：</span>
              <span style={{ borderBottom: '1px dotted #aaa', minWidth: '80px' }}>{shipment.customer?.phone || '-'}</span>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>手　機：</span>
              <span style={{ borderBottom: '1px dotted #aaa', minWidth: '80px' }}>{shipment.customer?.phone2 || '-'}</span>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>統　編：</span>
              <span style={{ borderBottom: '1px dotted #aaa', minWidth: '65px' }}>{shipment.customer?.tax_id || '-'}</span>
              <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>日　期：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 1 }}>{shipment.shipment_date ? formatRocDate(shipment.shipment_date) : '-'}</span>
            </div>
          </div>

          {/* ── 收費標準 ── */}
          <div style={{
            border: '1px solid #1a1a1a',
            padding: '1px 3px',
            marginBottom: '1px',
            fontSize: '6.5px',
            lineHeight: 1.4,
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5px' }}>收費標準：</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 3px' }}>
              <span>□ 診斷檢測費——免費</span>
              <span>□ 車馬費——300</span>
              <span>□ 系統重灌——800</span>
              <span>□ 硬體安裝（單項）——300</span>
              <span>□ 軟體設定、調整——300</span>
              <span>□ 網路架設（材料另計）——1000</span>
            </div>
          </div>

          {/* ── 商品明細表格 ── */}
          <div style={{ marginBottom: '1px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5px' }}>
              <thead>
                <tr>
                  <th style={th}>項 目 名 稱</th>
                  <th style={{ ...th, width: '8%', textAlign: 'center' }}>數量</th>
                  <th style={{ ...th, width: '7%', textAlign: 'center' }}>單位</th>
                  <th style={{ ...th, width: '16%', textAlign: 'right' }}>單　價</th>
                  <th style={{ ...th, width: '16%', textAlign: 'right' }}>金　額</th>
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
                  items.map((item: any) => (
                    <tr key={item.id}>
                      <td style={td}>{item.product_name || item.product_id}</td>
                      <td style={{ ...td, textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ ...td, textAlign: 'center' }}>組</td>
                      <td style={{ ...td, textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))
                )}
                {items.length < 3 && Array.from({ length: Math.max(0, 3 - items.length) }).map((_, i) => (
                  <tr key={`e${i}`}>
                    <td style={{ ...td, height: '11px' }}></td>
                    <td style={{ ...td, height: '11px', textAlign: 'center' }}></td>
                    <td style={{ ...td, height: '11px', textAlign: 'center' }}></td>
                    <td style={{ ...td, height: '11px', textAlign: 'right' }}></td>
                    <td style={{ ...td, height: '11px', textAlign: 'right' }}></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ ...td, fontWeight: 'bold', textAlign: 'right', paddingRight: '4px', fontSize: '8px' }}>
                    合計：共 {totalQty} 項
                  </td>
                  <td style={td}></td>
                  <td style={td}></td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 'bold', fontSize: '8.5px' }}>
                    {formatCurrency(totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── 備註 ── */}
          <div style={{ border: '1px solid #1a1a1a', padding: '1px 3px', marginBottom: '1px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5px', fontSize: '7px' }}>備　註：</div>
            <div style={{ fontSize: '6.5px', lineHeight: 1.3 }}>
              玉山銀行（808）豐原分行　帳號：0381440003611　戶名：嘉祐資訊企業有限公司
            </div>
            {shipment.note && (
              <div style={{ fontSize: '6.5px', marginTop: '1px', lineHeight: 1.3, color: '#444' }}
                dangerouslySetInnerHTML={{ __html: shipment.note }} />
            )}
          </div>

          {/* ── 簽收欄 ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid #1a1a1a' }}>
            <div style={{ padding: '1px 3px', borderRight: '1px solid #1a1a1a' }}>
              <div style={{ fontWeight: 'bold', fontSize: '7px', letterSpacing: '2px' }}>工程師</div>
              <div style={{ borderBottom: '1px solid #1a1a1a', height: '9px', marginTop: '1px' }}></div>
            </div>
            <div style={{ padding: '1px 3px', borderRight: '1px solid #1a1a1a' }}>
              <div style={{ fontWeight: 'bold', fontSize: '7px', letterSpacing: '2px' }}>客戶簽名</div>
              <div style={{ borderBottom: '1px solid #1a1a1a', height: '9px', marginTop: '1px' }}></div>
            </div>
            <div style={{ padding: '1px 3px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '7px', letterSpacing: '2px' }}>日　期</div>
              <div style={{ borderBottom: '1px solid #1a1a1a', height: '9px', marginTop: '1px' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @page {
          size: 8.5in 5.5in portrait;
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: #fff !important;
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          * {
            box-sizing: border-box !important;
          }
          .no-print {
            display: none !important;
          }
          /* Scale wrapper: scale the content to fit within 5.5in height */
          .print-scale-wrapper {
            transform-origin: top center !important;
            width: 8.5in !important;
            /* Scale to fit 5.5in - the actual content height is ~303px at 96dpi ≈ 3.15in,
               so we use scale(1) but constrain the paper height explicitly */
          }
          .print-paper {
            width: 8.5in !important;
            padding: 0.09in 0.14in !important;
            margin: 0 !important;
            box-shadow: none !important;
            overflow: hidden !important;
            border: none !important;
            /* Constrain height to 5.5in - this forces content to fit */
            max-height: 5.5in !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}

const th: React.CSSProperties = {
  background: '#1a1a1a',
  color: '#fff',
  padding: '1px 3px',
  textAlign: 'left',
  fontSize: '7px',
  letterSpacing: '0.5px',
  border: '1px solid #1a1a1a',
  fontWeight: 'bold',
};

const td: React.CSSProperties = {
  border: '1px solid #1a1a1a',
  padding: '1px 3px',
  verticalAlign: 'middle',
  lineHeight: 1.25,
};
