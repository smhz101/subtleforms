/**
 * DIAGNOSTIC Dashboard - Test Version
 * If you see this page load, React rendering is working
 */
export default function Dashboard() {
  return (
    <div style={{ padding: '40px', background: 'white', minHeight: '400px' }}>
      <h1 style={{ color: '#059669', marginBottom: '20px' }}>✅ Dashboard Test - SUCCESS</h1>
      <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
          <strong>✓ React is rendering correctly</strong>
        </p>
        <p style={{ margin: '0', color: '#666' }}>
          Page loaded at: {new Date().toLocaleString()}
        </p>
      </div>
      
      <div style={{ background: '#fef3c7', padding: '20px', borderRadius: '8px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>
          <strong>⚠️ This is a diagnostic version</strong>
        </p>
        <p style={{ margin: '0', color: '#666', fontSize: '13px' }}>
          No API calls, no complex components. 
          If this loads but the full dashboard doesn't, we know the issue is in:
        </p>
        <ul style={{ marginTop: '10px', color: '#666', fontSize: '13px' }}>
          <li>API fetch logic</li>
          <li>AdminShell component</li>
          <li>LicenseStatusIndicator component</li>
          <li>Or data-heavy rendering</li>
        </ul>
      </div>
    </div>
  );
}
