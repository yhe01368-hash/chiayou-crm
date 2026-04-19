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

  // Auto-trigger print dialog when data loads
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

  // Format date to ROC year
  const formatRocDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const rocYear = d.getFullYear() - 1911;
    return `${rocYear} 年 ${format(d, 'MM 月 dd 日', { locale: zhTW })}`;
  };

  const formatCurrency = (amount: number) => {
    return '$' + Number(amount).toLocaleString();
  };

  const items = shipment.items || [];
  const emptyRows = Math.max(0, 4 - items.length);

  return (
    <div className="min-h-screen bg-gray-100" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '16px' }}>
      {/* Non-print controls */}
      <div className="no-print" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <Link to="/shipments" className="btn btn-secondary flex items-center gap-2">
          <ArrowLeft size={16} /> 返回列表
        </Link>
        <button onClick={() => window.print()} className="btn btn-primary flex items-center gap-2">
          <Printer size={16} /> 列印
        </button>
      </div>

      {/* Printable A5 paper */}
      <div
        className="print-paper"
        style={{
          width: '148mm',
          minHeight: '210mm',
          backgroundColor: '#fff',
          padding: '8mm 9mm',
          boxSizing: 'border-box',
          fontFamily: '"Noto Sans CJK TC", "Microsoft JhengHei", "Heiti TC", sans-serif',
          fontSize: '11px',
          color: '#1a1a1a',
        }}
      >
        {/* ── 頁面標題 ── */}
        <div style={{
          textAlign: 'center',
          fontSize: '17px',
          fontWeight: 'bold',
          letterSpacing: '7px',
          border: '2px solid #1a1a1a',
          padding: '3px 0',
          marginBottom: '5px',
        }}>
          出　貨　單
        </div>

        {/* ── 公司資訊列 ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1.5px solid #1a1a1a',
          paddingBottom: '3px',
          marginBottom: '3px',
          fontSize: '10px',
          lineHeight: '1.5',
        }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>嘉祐資訊企業有限公司</div>
            <div style={{ color: '#444' }}>台中市豐原區中正路 737 巷 23 弄 2 號</div>
          </div>
          <div style={{ color: '#444', textAlign: 'right', whiteSpace: 'nowrap' }}>
            電話: 04-25279968　傳真: 04-25279997
          </div>
        </div>

        {/* ── 單號列 ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '4px',
        }}>
          <span style={{
            background: '#1a1a1a',
            color: '#fff',
            padding: '1px 6px',
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '1px',
          }}>
            貨單號碼：{shipment.shipment_number}
          </span>
        </div>

        {/* ── 客戶資料 ── */}
        <div style={{ border: '1px solid #1a1a1a', padding: '4px 6px', marginBottom: '4px' }}>
          <div style={{ display: 'flex', gap: '4px', lineHeight: '1.8', fontSize: '10.5px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', minWidth: '68px' }}>客戶名稱：</span>
            <span style={{ borderBottom: '1px dotted #aaa', flex: 1, paddingRight: '8px' }}>
              {shipment.customer?.name || '-'}
            </span>
            <span style={{ fontWeight: 'bold', minWidth: '68px' }}>客戶地址：</span>
            <span style={{ borderBottom: '1px dotted #aaa', flex: 1 }}>
              {shipment.customer?.address || '-'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', lineHeight: '1.8', fontSize: '10.5px', marginTop: '2px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <span style={{ fontWeight: 'bold', minWidth: '45px' }}>電　話：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 1 }}>{shipment.customer?.phone || '-'}</span>
              <span style={{ fontWeight: 'bold', minWidth: '40px' }}>傳　真：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 1 }}>-</span>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <span style={{ fontWeight: 'bold', minWidth: '40px' }}>手　機：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 1 }}>-</span>
              <span style={{ fontWeight: 'bold', minWidth: '40px' }}>統　編：</span>
              <span style={{ borderBottom: '1px dotted #aaa', flex: 1 }}>{shipment.customer?.tax_id || '-'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px', lineHeight: '1.8', fontSize: '10.5px', marginTop: '2px' }}>
            <span style={{ fontWeight: 'bold', minWidth: '68px' }}>聯絡人：</span>
            <span style={{ borderBottom: '1px dotted #aaa', flex: 1 }}>-</span>
          </div>
        </div>

        {/* ── 收費標準 ── */}
        <div style={{ border: '1px solid #1a1a1a', padding: '4px 6px', marginBottom: '4px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '3px', fontSize: '11px' }}>收費標準：</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', lineHeight: '1.7', fontSize: '10px' }}>
            {[
              { label: '診斷檢測費　───　免費', checked: true },
              { label: '車馬費　───　300', checked: false },
              { label: '硬體安裝(單項)　───　300', checked: false },
              { label: '軟體設定、調整　───　300', checked: false },
              { label: '系統重灌　───　800', checked: false },
              { label: '網路架設(材料另計)　───　1000', checked: false },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{
                  width: '11px',
                  height: '11px',
                  border: '1px solid #1a1a1a',
                  display: 'inline-block',
                  flexShrink: 0,
                  background: f.checked ? '#1a1a1a' : '#fff',
                  position: 'relative',
                }}>
                  {f.checked && <span style={{ color: '#fff', fontSize: '9px', position: 'absolute', top: '-2px', left: '1px' }}>✓</span>}
                </span>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── 維修記錄表格 ── */}
        <div style={{ marginBottom: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
            <thead>
              <tr>
                <th style={tableThStyle(18)}>維修項目</th>
                <th style={tableThStyle(7)}>數量</th>
                <th style={tableThStyle(7)}>單位</th>
                <th style={tableThStyle(18)}>單價</th>
                <th style={tableThStyle(18)}>金額</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id}>
                  <td style={tableTdStyle()}>{item.product_name}</td>
                  <td style={{ ...tableTdStyle(), textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ ...tableTdStyle(), textAlign: 'center' }}>組</td>
                  <td style={{ ...tableTdStyle(), textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                  <td style={{ ...tableTdStyle(), textAlign: 'right' }}>{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
              {Array.from({ length: emptyRows }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td style={{ ...tableTdStyle(), height: '20px' }}></td>
                  <td style={{ ...tableTdStyle(), height: '20px' }}></td>
                  <td style={{ ...tableTdStyle(), height: '20px' }}></td>
                  <td style={{ ...tableTdStyle(), height: '20px' }}></td>
                  <td style={{ ...tableTdStyle(), height: '20px' }}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 總計 ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'baseline',
          marginBottom: '4px',
          borderTop: '1.5px solid #1a1a1a',
          borderBottom: '1.5px solid #1a1a1a',
          padding: '3px 0',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '3px', marginRight: '8px' }}>總　計：</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{formatCurrency(shipment.total_amount)}</span>
        </div>

        {/* ── 備註 ── */}
        <div style={{ border: '1px solid #1a1a1a', padding: '4px 6px', marginBottom: '4px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '11px' }}>備　註：</div>
          <div style={{ lineHeight: '1.65', fontSize: '10px' }}>
            玉山銀行（銀行代號 808）　分行別：豐原分行　帳號：0381440003611　戶名：嘉祐資訊企業有限公司
          </div>
        </div>

        {/* ── 注意事項 ── */}
        <div style={{ border: '1px solid #1a1a1a', padding: '4px 6px', marginBottom: '4px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '11px' }}>注意事項：</div>
          <ol style={{ paddingLeft: '1.5em', lineHeight: '1.65', fontSize: '10px' }}>
            <li>請注意客戶送修電腦其內裝所有軟體，有關版權問題一律與本公司無關，特此聲明！</li>
            <li>如有需要安裝新軟體，請客戶自備版權軟體，或由本公司代購。</li>
            <li>客戶取回之產品，三日內同問題應立即告知，逾期無效；不同原因之問題視為計費維修。</li>
            <li>更換／修理之零件保證期限為壹個月。</li>
            <li>客戶送修之產品若為故障品，本公司不負賠償之責任。</li>
          </ol>
        </div>

        {/* ── 簽收欄 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid #1a1a1a' }}>
          <div style={{ padding: '5px 6px', borderRight: '1px solid #1a1a1a' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', letterSpacing: '2px' }}>工程師</div>
            <div style={{ borderBottom: '1px solid #1a1a1a', height: '16px', marginTop: '3px' }}></div>
          </div>
          <div style={{ padding: '5px 6px', borderRight: '1px solid #1a1a1a' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', letterSpacing: '2px' }}>客戶簽名</div>
            <div style={{ borderBottom: '1px solid #1a1a1a', height: '16px', marginTop: '3px' }}></div>
          </div>
          <div style={{ padding: '5px 6px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '11px', letterSpacing: '2px' }}>日　期</div>
            <div style={{ borderBottom: '1px solid #1a1a1a', height: '16px', marginTop: '3px' }}></div>
            <div style={{ marginTop: '2px', fontSize: '10px', color: '#555' }}>
              {shipment.shipment_date ? formatRocDate(shipment.shipment_date) : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: 148mm 210mm;
            margin: 0;
          }
          body {
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-paper {
            width: 148mm !important;
            min-height: 210mm !important;
            padding: 8mm 9mm !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function tableThStyle(width: number) {
  return {
    background: '#1a1a1a',
    color: '#fff',
    padding: '3px 4px',
    textAlign: 'center' as const,
    fontSize: '10px',
    letterSpacing: '1px',
    border: '1px solid #1a1a1a',
    width: `${width}%`,
  };
}

function tableTdStyle() {
  return {
    border: '1px solid #1a1a1a',
    padding: '3px 4px',
    verticalAlign: 'middle',
    lineHeight: '1.5',
  };
}
