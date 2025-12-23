import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Presentation,
  Type,
  Merge,
  Zap,
  Lock,
  Plus,
  Settings,
  History,
  Download,
  CheckCircle2,
  Loader2,
  X,
  Upload,
  ShieldCheck,
  Eye,
  Share2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PDFDocument } from 'pdf-lib';
import { jsPDF } from 'jspdf';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// PDF Viewer Imports
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set worker for react-pdf
// pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState(0);
  const [selectedTool, setSelectedTool] = useState(null);
  const [files, setFiles] = useState([]);
  const [resultUrl, setResultUrl] = useState(null);
  const [error, setError] = useState(null);
  const [viewingPdf, setViewingPdf] = useState(null);
  const fileInputRef = useRef(null);

  // PDF Viewer State
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [viewMode, setViewMode] = useState('single'); // 'single' or 'grid'
  const [containerWidth, setContainerWidth] = useState(0);
  const viewerContainerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Handle responsive width for PDF
  useEffect(() => {
    const updateWidth = () => {
      if (viewerContainerRef.current) {
        setContainerWidth(viewerContainerRef.current.offsetWidth - 40);
      }
    };
    window.addEventListener('resize', updateWidth);
    if (viewingPdf) setTimeout(updateWidth, 100);
    return () => window.removeEventListener('resize', updateWidth);
  }, [viewingPdf]);

  const tools = [
    { id: 'word', name: 'Word to PDF', icon: <FileText />, color: '#2b579a' },
    { id: 'excel', name: 'Excel to PDF', icon: <FileSpreadsheet />, color: '#217346' },
    { id: 'ppt', name: 'PPT to PDF', icon: <Presentation />, color: '#d24726' },
    { id: 'image', name: 'Image to PDF', icon: <ImageIcon />, color: '#e04433' },
    { id: 'text', name: 'Text to PDF', icon: <Type />, color: '#4a4a4a' },
    { id: 'merge', name: 'Merge PDF', icon: <Merge />, color: '#6366f1' },
    { id: 'compress', name: 'Compress', icon: <Zap />, color: '#f59e0b' },
    { id: 'secure', name: 'Password', icon: <Lock />, color: '#10b981' },
    { id: 'view', name: 'View PDF', icon: <Eye />, color: '#ec4899' },
  ];

  const handleToolClick = (tool) => {
    setError(null);
    setSelectedTool(tool);
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    setFiles(selectedFiles);

    if (selectedTool?.id === 'view') {
      const url = URL.createObjectURL(selectedFiles[0]);
      setViewingPdf(url);
      setPageNumber(1);
      return;
    }

    setIsProcessing(true);
    setProcessStep(1);
    setError(null);

    try {
      let blob;
      const toolId = selectedTool?.id;

      if (toolId === 'text') {
        blob = await convertTextToPdf(selectedFiles[0]);
      } else if (toolId === 'merge') {
        blob = await mergePdfs(selectedFiles);
      } else if (toolId === 'image') {
        blob = await convertImagesToPdf(selectedFiles);
      } else if (toolId === 'word') {
        blob = await convertWordToPdf(selectedFiles[0]);
      } else if (toolId === 'excel') {
        blob = await convertExcelToPdf(selectedFiles[0]);
      } else if (toolId === 'quick') {
        const file = selectedFiles[0];
        if (file.type === 'application/pdf') {
          const url = URL.createObjectURL(file);
          setViewingPdf(url);
          setIsProcessing(false);
          return;
        }
        if (file.type.startsWith('image/')) {
          blob = await convertImagesToPdf(selectedFiles);
        } else if (file.type === 'text/plain') {
          blob = await convertTextToPdf(file);
        } else if (file.name.endsWith('.docx')) {
          blob = await convertWordToPdf(file);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          blob = await convertExcelToPdf(file);
        } else {
          blob = await createPlaceholderPdf(`Converted from ${file.name}`);
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setProcessStep(2);
        await new Promise(resolve => setTimeout(resolve, 1000));
        blob = await createPlaceholderPdf(`${selectedTool?.name} - Feature Coming Soon`);
      }

      if (!blob || blob.size === 0) throw new Error("Generated PDF is empty");

      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setProcessStep(3);
    } catch (err) {
      console.error("Processing error:", err);
      setError("Failed to process file. Please try a different format.");
      setIsProcessing(false);
    }
  };

  const createPlaceholderPdf = async (message) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 241);
    doc.text("PDF Master Pro", 105, 40, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text(message, 105, 60, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Professional Document Management", 105, 280, { align: 'center' });
    return doc.output('blob');
  };

  const convertTextToPdf = async (file) => {
    const text = await file.text();
    const doc = new jsPDF();
    doc.setFontSize(12);
    const lines = doc.splitTextToSize(text, 180);
    doc.text(lines, 15, 20);
    return doc.output('blob');
  };

  const convertWordToPdf = async (file) => {
    setProcessStep(1);
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    setProcessStep(2);
    const doc = new jsPDF();
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(result.value, 170);

    let cursorY = 20;
    lines.forEach((line) => {
      if (cursorY > 280) {
        doc.addPage();
        cursorY = 20;
      }
      doc.text(line, 20, cursorY);
      cursorY += 7;
    });

    return doc.output('blob');
  };

  const convertExcelToPdf = async (file) => {
    setProcessStep(1);
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    setProcessStep(2);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(10);

    let cursorY = 20;
    data.forEach((row) => {
      if (cursorY > 190) {
        doc.addPage();
        cursorY = 20;
      }
      doc.text(row.join(' | '), 15, cursorY);
      cursorY += 8;
    });

    return doc.output('blob');
  };

  const convertImagesToPdf = async (files) => {
    const doc = new jsPDF();
    for (let i = 0; i < files.length; i++) {
      if (i > 0) doc.addPage();
      const imgData = await readFileAsDataURL(files[i]);
      const imgProps = doc.getImageProperties(imgData);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      const finalHeight = Math.min(pdfHeight, doc.internal.pageSize.getHeight());
      doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, finalHeight);
    }
    return doc.output('blob');
  };

  const readFileAsDataURL = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const mergePdfs = async (files) => {
    const mergedPdf = await PDFDocument.create();
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
    const pdfBytes = await mergedPdf.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  };

  const resetProcess = () => {
    setIsProcessing(false);
    setProcessStep(0);
    setSelectedTool(null);
    setFiles([]);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setError(null);
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  return (
    <div className="app-container">
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--bg-color)',
              zIndex: 2000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px'
            }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              style={{
                width: '100px',
                height: '100px',
                background: 'var(--primary-gradient)',
                borderRadius: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 40px rgba(99, 102, 241, 0.5)'
              }}
            >
              <FileText size={50} color="white" />
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{ textAlign: 'center' }}
            >
              <h1 style={{ fontSize: '2.5rem', marginBottom: '4px' }}>PDF Master</h1>
              <p style={{ letterSpacing: '2px', textTransform: 'uppercase', fontSize: '0.8rem' }}>Professional Suite</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        multiple={selectedTool?.id === 'merge' || selectedTool?.id === 'image'}
        accept={selectedTool?.id === 'view' ? 'application/pdf' : '*'}
        onChange={handleFileChange}
      />

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            PDF Master
          </motion.h1>
          <p>Smart Document Management</p>
        </div>
        <div className="glass-card" style={{ padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>
          <Settings size={20} />
        </div>
      </header>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.2)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: '#ef4444'
            }}
          >
            <AlertCircle size={20} />
            <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Action */}
      <motion.div
        className="glass-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ marginBottom: '32px', textAlign: 'center' }}
      >
        <div style={{
          width: '64px',
          height: '64px',
          background: 'var(--primary-gradient)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)'
        }}>
          <Plus color="white" size={32} />
        </div>
        <h2>Quick Convert</h2>
        <p style={{ marginBottom: '20px' }}>Upload any file to start</p>
        <button className="btn-primary" onClick={() => handleToolClick({ id: 'quick', name: 'Quick Convert' })}>
          <Upload size={20} /> Select File
        </button>
      </motion.div>

      {/* Tools Grid */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2>Professional Tools</h2>
          <span style={{ color: 'var(--accent-color)', fontSize: '0.9rem', fontWeight: '500' }}>View All</span>
        </div>
        <div className="tools-grid">
          {tools.map((tool, index) => (
            <motion.div
              key={tool.id}
              className="glass-card tool-card"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              onClick={() => handleToolClick(tool)}
            >
              <div className="tool-icon" style={{ color: tool.color }}>
                {tool.icon}
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{tool.name}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Security Banner */}
      <motion.div
        className="glass-card"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        style={{
          marginTop: '24px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(16, 185, 129, 0.05)',
          borderColor: 'rgba(16, 185, 129, 0.2)'
        }}
      >
        <ShieldCheck color="#10b981" size={24} />
        <div>
          <h4 style={{ fontSize: '0.9rem', color: '#10b981' }}>Secure Processing</h4>
          <p style={{ fontSize: '0.75rem' }}>Your files are processed locally and never stored.</p>
        </div>
      </motion.div>

      {/* PDF Viewer Overlay */}
      <AnimatePresence>
        {viewingPdf && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--bg-color)',
              zIndex: 3000,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <header style={{
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--card-border)',
              background: 'rgba(5, 5, 7, 0.8)',
              backdropFilter: 'blur(10px)'
            }}>
              <button
                onClick={() => setViewingPdf(null)}
                className="btn-secondary"
                style={{ width: 'auto', padding: '8px 12px' }}
              >
                <ChevronLeft size={20} />
              </button>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setViewMode('single')}
                  className="glass-card"
                  style={{ padding: '8px', background: viewMode === 'single' ? 'var(--accent-color)' : 'transparent' }}
                >
                  <Maximize2 size={18} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className="glass-card"
                  style={{ padding: '8px', background: viewMode === 'grid' ? 'var(--accent-color)' : 'transparent' }}
                >
                  <LayoutGrid size={18} />
                </button>
                <div style={{ width: '1px', height: '20px', background: 'var(--card-border)', margin: '0 4px' }} />
                <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="glass-card" style={{ padding: '8px' }}><ZoomOut size={18} /></button>
                <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="glass-card" style={{ padding: '8px' }}><ZoomIn size={18} /></button>
              </div>

              <a href={viewingPdf} download="document.pdf" className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }}>
                <Download size={18} />
              </a>
            </header>

            <div
              ref={viewerContainerRef}
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '20px',
                background: '#0a0a0c',
                scrollBehavior: 'smooth'
              }}
            >
              <Document
                file={viewingPdf}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<Loader2 className="animate-spin" size={40} color="var(--accent-color)" style={{ margin: '100px auto' }} />}
              >
                {viewMode === 'single' ? (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      width={containerWidth > 0 ? containerWidth : undefined}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                      className="pdf-page-shadow"
                    />
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '20px',
                    padding: '10px'
                  }}>
                    {Array.from(new Array(numPages), (el, index) => (
                      <div
                        key={`page_${index + 1}`}
                        onClick={() => { setPageNumber(index + 1); setViewMode('single'); }}
                        style={{ cursor: 'pointer', textAlign: 'center' }}
                      >
                        <Page
                          pageNumber={index + 1}
                          scale={0.3}
                          renderAnnotationLayer={false}
                          renderTextLayer={false}
                          className="pdf-page-shadow"
                        />
                        <p style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{index + 1}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Document>
            </div>

            {viewMode === 'single' && (
              <footer style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px',
                borderTop: '1px solid var(--card-border)',
                background: 'rgba(5, 5, 7, 0.8)',
                backdropFilter: 'blur(10px)'
              }}>
                <button
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber(p => p - 1)}
                  className="glass-card"
                  style={{ padding: '8px', opacity: pageNumber <= 1 ? 0.5 : 1 }}
                >
                  <ChevronLeft size={24} />
                </button>
                <span style={{ fontWeight: '500' }}>{pageNumber} / {numPages}</span>
                <button
                  disabled={pageNumber >= numPages}
                  onClick={() => setPageNumber(p => p + 1)}
                  className="glass-card"
                  style={{ padding: '8px', opacity: pageNumber >= numPages ? 0.5 : 1 }}
                >
                  <ChevronRight size={24} />
                </button>
              </footer>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing Modal */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              zIndex: 1000
            }}
          >
            <motion.div
              className="glass-card"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              style={{ width: '100%', maxWidth: '400px', textAlign: 'center', position: 'relative' }}
            >
              <button
                onClick={resetProcess}
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>

              {processStep === 1 && (
                <div className="animate-fade-in">
                  <div style={{ marginBottom: '24px' }}>
                    <Loader2 className="animate-spin" size={48} color="var(--accent-color)" style={{ margin: '0 auto' }} />
                  </div>
                  <h2>Processing {selectedTool?.name}</h2>
                  <p>Reading {files.length} file(s)...</p>
                </div>
              )}

              {processStep === 2 && (
                <div className="animate-fade-in">
                  <div style={{ marginBottom: '24px' }}>
                    <Loader2 className="animate-spin" size={48} color="var(--accent-color)" style={{ margin: '0 auto' }} />
                  </div>
                  <h2>Finalizing</h2>
                  <p>Building your PDF document...</p>
                </div>
              )}

              {processStep === 3 && (
                <div className="animate-fade-in">
                  <div style={{ marginBottom: '24px', color: '#10b981' }}>
                    <CheckCircle2 size={64} style={{ margin: '0 auto' }} />
                  </div>
                  <h2>Success!</h2>
                  <p style={{ marginBottom: '24px' }}>Your file is ready.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button className="btn-primary" onClick={() => { setViewingPdf(resultUrl); setIsProcessing(false); }}>
                      <Eye size={20} /> View & Download
                    </button>
                    <a
                      href={resultUrl}
                      download={`PDF_Master_${Date.now()}.pdf`}
                      className="btn-secondary"
                      style={{ textDecoration: 'none' }}
                    >
                      <Download size={20} /> Direct Download
                    </a>
                    <button className="btn-secondary" onClick={resetProcess} style={{ marginTop: '8px', border: 'none' }}>
                      Done
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{
        __html: `
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .pdf-page-shadow canvas {
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border-radius: 8px;
          max-width: 100% !important;
          height: auto !important;
        }
        .react-pdf__Document {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }
      `}} />
    </div>
  );
};

export default App;
