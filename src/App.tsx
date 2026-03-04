import React, { useState, useEffect } from 'react';
import { Settings, Search, AlertCircle, CheckCircle2, CreditCard, User, Clock, FileText, ChevronDown, ChevronUp, Download } from 'lucide-react';

export default function App() {
  // Estados principales
  const [paymentId, setPaymentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);

  // Estados de configuración (guardados en localStorage)
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('apiUrl') || 'https://uc.interbet.com.ar/unicobros/consultaPago');
  const [apiHeaders, setApiHeaders] = useState(() => localStorage.getItem('apiHeaders') || '{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer TU_TOKEN"\n}');
  const [apiBody, setApiBody] = useState(() => localStorage.getItem('apiBody') || '{\n  "paymentId": "{{PAYMENT_ID}}"\n}');

  // Guardar config al cambiar
  useEffect(() => {
    localStorage.setItem('apiUrl', apiUrl);
    localStorage.setItem('apiHeaders', apiHeaders);
    localStorage.setItem('apiBody', apiBody);
  }, [apiUrl, apiHeaders, apiBody]);

  // Función para descargar el script de PowerShell
  const handleDownloadScript = () => {
    const scriptContent = `# Script para consultar Payment ID
param (
    [string]$paymentId = $(Read-Host "Ingresa el Payment ID")
)

# URL de Unicobros
$url = "https://uc.interbet.com.ar/unicobros/consultaPago"

# ⚠️ SI REQUIERE TOKEN, REEMPLAZALO ACA. SI NO, DEJALO VACIO ⚠️
$token = "Bearer TU_TOKEN_AQUI"

# Armamos el body
$body = @{
    paymentId = $paymentId
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

# Si tenes un token, lo agregamos a los headers
if ($token -ne "Bearer TU_TOKEN_AQUI") {
    $headers.Add("Authorization", $token)
}

Write-Host "Consultando el pago $paymentId ..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body

    # Buscamos en la raiz y en posibles sub-objetos (como 'data' o 'payment')
    
    $t = $response.data.transaction
    $p = $t.payment
    $u = $t.user

    $id = if ($p.id) { $p.id } else { $response.id }
    $res = if ($null -ne $response.result) { $response.result } else { $t.result }
    $created = $p.created
    $description = $p.description
    $requestedTotal = $p.requestedTotal
    $message = if ($p.status.message) { $p.status.message } else { $response.message }
    $total = $p.total
    $updated = $p.updated
    $email = $u.email
    $name = $u.name
    $identification = $u.identification
    $phone = $u.phone

    Write-Host "\`n--- RESULTADO ---" -ForegroundColor Green
    Write-Host "ID: $id"
    Write-Host "Resultado: $res"
    Write-Host "Creado: $created"
    Write-Host "Descripcion: $description"
    Write-Host "Total Solicitado: $requestedTotal"
    Write-Host "Mensaje: $message"
    Write-Host "Total: $total"
    Write-Host "Actualizado: $updated"
    Write-Host "Email: $email"
    Write-Host "Nombre: $name"
    Write-Host "Identificacion: $identification"
    Write-Host "Telefono: $phone"
    Write-Host "-----------------\`n" -ForegroundColor Green

} catch {
    Write-Host "Hubo un error al consultar: $_" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Detalles: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host "Presiona Enter para salir..."
Read-Host
`;

    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ConsultarPago.ps1';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Función para buscar las claves en cualquier nivel del JSON de respuesta
  const extractFields = (data: any) => {
    const targetFields = ['created', 'description', 'id', 'requestedTotal', 'message', 'total', 'updated', 'email', 'name', 'identification', 'phone', 'result'];
    const extracted: Record<string, any> = {};

    const search = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key in obj) {
        if (targetFields.includes(key) && extracted[key] === undefined) {
          extracted[key] = obj[key];
        }
        if (typeof obj[key] === 'object') {
          search(obj[key]);
        }
      }
    };

    search(data);
    return extracted;
  };

  const handleConsultar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentId.trim()) {
      setError('Por favor, ingresá un Payment ID.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setRawResponse(null);

    try {
      // Parsear headers
      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(apiHeaders);
      } catch (e) {
        throw new Error('Los Headers no tienen un formato JSON válido.');
      }

      // Preparar body reemplazando la variable
      const finalBody = apiBody.replace(/{{PAYMENT_ID}}/g, paymentId.trim());
      
      // Validar que el body sea JSON válido
      try {
        JSON.parse(finalBody);
      } catch (e) {
        throw new Error('El Body no tiene un formato JSON válido después de reemplazar el ID.');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: parsedHeaders,
        body: finalBody,
      });

      const data = await response.json();
      setRawResponse(data);

      if (!response.ok) {
        throw new Error(data.message || `Error del servidor: ${response.status}`);
      }

      const extractedData = extractFields(data);
      if (Object.keys(extractedData).length === 0) {
        setError('La consulta fue exitosa, pero no se encontraron los campos esperados en la respuesta.');
      } else {
        setResult(extractedData);
      }

    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al consultar la API. Revisá la configuración o si hay problemas de CORS.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              Consulta Unicobros
              <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">v1.0</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">Buscá la información de un pago sin usar Postman.</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownloadScript}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
              title="Descargar script de PowerShell (.ps1)"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Descargar .ps1</span>
            </button>
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
              title="Configuración de la API"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Configuración (Colapsable) */}
        {showConfig && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4 animate-in slide-in-from-top-4 fade-in duration-200">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-400" />
              Configuración de la API
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Configurá los datos de tu Postman acá. Se guardan automáticamente en tu navegador.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL del Endpoint (POST)</label>
                <input 
                  type="text" 
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                  placeholder="https://api.ejemplo.com/pagos"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Headers (JSON)</label>
                  <textarea 
                    value={apiHeaders}
                    onChange={(e) => setApiHeaders(e.target.value)}
                    className="w-full h-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Body (JSON)</label>
                  <p className="text-xs text-slate-500 mb-1">Usá <code className="bg-slate-200 px-1 rounded">{"{{PAYMENT_ID}}"}</code> donde va el ID.</p>
                  <textarea 
                    value={apiBody}
                    onChange={(e) => setApiBody(e.target.value)}
                    className="w-full h-28 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Buscador */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <form onSubmit={handleConsultar} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                placeholder="Pegá el Payment ID acá (ej: WXKSHY3F7H5SC2TRCV3LNQ)"
                className="block w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-4 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 focus:ring-4 focus:ring-slate-200 transition-all disabled:opacity-70 flex items-center justify-center min-w-[160px]"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Consultar'
              )}
            </button>
          </form>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div className="bg-red-50 text-red-800 p-4 rounded-xl flex items-start gap-3 border border-red-100">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        {/* Resultados */}
        {result && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Tarjeta Principal */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="border-b border-slate-100 p-6 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Detalle del Pago</h3>
                    <p className="text-sm text-slate-500 font-mono">{result.id || paymentId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-light tracking-tight text-slate-900">
                    ${result.total !== undefined ? result.total : '-'}
                  </div>
                  <div className="text-xs font-medium text-green-600 uppercase tracking-wider">
                    {result.message || 'Aprobado'}
                  </div>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Columna 1: Info del Pago */}
                <div className="space-y-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Datos de la Operación
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="text-sm text-slate-500">Resultado</span>
                      <span className="text-sm font-medium text-slate-900">
                        {result.result !== undefined ? (result.result ? 'Exitoso (True)' : 'Fallido (False)') : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="text-sm text-slate-500">Descripción</span>
                      <span className="text-sm font-medium text-slate-900">{result.description || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="text-sm text-slate-500">Total Solicitado</span>
                      <span className="text-sm font-medium text-slate-900">${result.requestedTotal !== undefined ? result.requestedTotal : '-'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="text-sm text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3"/> Creado</span>
                      <span className="text-sm font-medium text-slate-900 font-mono">{result.created ? new Date(result.created).toLocaleString() : '-'}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3">
                      <span className="text-sm text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3"/> Actualizado</span>
                      <span className="text-sm font-medium text-slate-900 font-mono">{result.updated ? new Date(result.updated).toLocaleString() : '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Columna 2: Info del Usuario */}
                <div className="space-y-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4" /> Datos del Cliente
                  </h4>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="text-sm text-slate-500">Nombre</span>
                      <span className="text-sm font-medium text-slate-900">{result.name || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="text-sm text-slate-500">Identificación</span>
                      <span className="text-sm font-medium text-slate-900 font-mono">{result.identification || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                      <span className="text-sm text-slate-500">Email</span>
                      <span className="text-sm font-medium text-slate-900">{result.email || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3">
                      <span className="text-sm text-slate-500">Teléfono</span>
                      <span className="text-sm font-medium text-slate-900">{result.phone || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* JSON Crudo (Opcional para debug) */}
            <details className="group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <summary className="p-4 cursor-pointer font-medium text-sm text-slate-600 flex items-center justify-between hover:bg-slate-50 transition-colors list-none">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Ver respuesta completa (JSON)
                </div>
                <span className="transition group-open:rotate-180">
                  <ChevronDown className="w-4 h-4" />
                </span>
              </summary>
              <div className="p-4 border-t border-slate-100 bg-slate-900 overflow-x-auto">
                <pre className="text-xs text-green-400 font-mono">
                  {JSON.stringify(rawResponse, null, 2)}
                </pre>
              </div>
            </details>

          </div>
        )}

      </div>
    </div>
  );
}
