import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
} from 'firebase/auth';
import {
    getFirestore,
    doc,
    addDoc,
    onSnapshot,
    collection,
    query,
    serverTimestamp,
    orderBy,
    limit,
    updateDoc,
    setLogLevel
} from 'firebase/firestore';

// Ativa o log de debug do Firestore para ajudar a identificar erros
setLogLevel('debug'); 

// --- CONFIGURAÇÕES GLOBAIS (FORNECIDAS PELO AMBIENTE) ---
// NOTA: Estas variáveis precisam ser definidas pelo ambiente (Lovable AI, Vercel ou .env local)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

const APP_VERSION = 'v1.0.3';

// --- COMPONENTES VISUAIS AUXILIARES ---

// Componente para o medidor vibracional (Gauge)
const VibrationGauge = React.memo(({ level }) => {
    const percentage = Math.min(100, Math.max(0, level));
    const angle = (percentage / 100) * 180;

    const needleStyle = useMemo(() => ({
        transform: `rotate(${angle}deg)`,
        transition: 'transform 1s ease-out',
        background: percentage < 50 ? '#EF4444' : (percentage < 80 ? '#FBBF24' : '#10B981'), // Vermelho, Amarelo, Verde
    }), [angle]);

    const displayColor = percentage < 50 ? 'text-red-400' : (percentage < 80 ? 'text-yellow-400' : 'text-green-400');

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-48 h-24 overflow-hidden rounded-t-full bg-gray-700">
                {/* Arco de Fundo */}
                <div className="absolute inset-0 w-full h-full rounded-t-full border-4 border-b-0 border-gray-600"></div>

                {/* Arco de Preenchimento (Simulado por um disco rotacionado) */}
                <div
                    className="absolute bottom-0 left-1/2 w-48 h-48 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                    style={{ transform: 'translateX(-50%) rotate(180deg)' }}
                >
                    <div className="absolute inset-0 bg-gray-800 rounded-full" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)', transform: 'scale(0.9)' }} />
                </div>
                
                {/* Ponteiro */}
                <div className="absolute bottom-0 left-1/2 h-full w-0.5 bg-gray-500" style={needleStyle}>
                    <div className="absolute top-0 left-1/2 w-2 h-2 rounded-full bg-white transform -translate-x-1 -translate-y-1"></div>
                </div>

                {/* Pino Central */}
                <div className="absolute bottom-0 left-1/2 w-4 h-4 rounded-full bg-white transform -translate-x-2 translate-y-2"></div>
            </div>
            <p className={`mt-2 font-bold text-xl ${displayColor}`}>{percentage.toFixed(0)}% Coerência</p>
            <p className="text-sm text-gray-400">Status Vibracional</p>
        </div>
    );
});


// Ícone de microfone animado para indicar gravação
const AnimatedMicIcon = React.memo(({ isRecording }) => (
    <div className={`p-4 rounded-full transition-all duration-300 ${isRecording ? 'bg-red-500 shadow-xl shadow-red-500/50 animate-pulse' : 'bg-gray-600'}`}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4z" clipRule="evenodd" />
            <path d="M5.58 10.58a1 1 0 011.42-1.42 5.002 5.002 0 006 0 1 1 0 011.42 1.42 7.002 7.002 0 01-8.84 0zM5 8a5 5 0 0110 0v4a5 5 0 01-10 0V8z" />
        </svg>
    </div>
));


// --- COMPONENTE PRINCIPAL ---

const App = () => {
    // 1. FIREBASE & AUTH STATE
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Conectando ao Campo Quântico...');

    // 2. APP STATE
    const [view, setView] = useState('dashboard');
    const [isMenuOpen, setIsMenuOpen] = useState(false); 
    const [intentions, setIntentions] = useState([]);
    const [recordingState, setRecordingState] = useState({
        isRecording: false,
        duration: 0,
        timerInterval: null,
        recordedAudioURL: null,
        intentionText: '',
        imageFile: null,
        imagePreviewUrl: null,
        imageBase64: null,
        mediaRecorder: null, 
        audioChunks: [],     
    });
    const [message, setMessage] = useState('');

    // --- FIREBASE INITIALIZATION & AUTH ---
    useEffect(() => {
        const initializeFirebase = async () => {
            try {
                if (Object.keys(firebaseConfig).length === 0) {
                    console.error("Configuração do Firebase não encontrada. Rodando em modo de simulação.");
                }

                const firebaseApp = initializeApp(firebaseConfig);
                const firestoreDb = getFirestore(firebaseApp);
                const authInstance = getAuth(firebaseApp);

                setDb(firestoreDb);
                setAuth(authInstance);

                if (typeof __initial_auth_token !== 'undefined') {
                    console.log("DEBUG: Tentando login com Custom Token...");
                    await signInWithCustomToken(authInstance, __initial_auth_token);
                } else {
                    console.log("DEBUG: Tentando login Anônimo...");
                    await signInAnonymously(authInstance);
                }

                onAuthStateChanged(authInstance, (user) => {
                    if (user) {
                        setUserId(user.uid);
                        setLoadingMessage('Sintonizando Frequência...');
                        console.log("DEBUG: Auth State Changed: Logado com UID:", user.uid);
                    } else {
                        const newId = crypto.randomUUID();
                        setUserId(newId);
                        console.log("DEBUG: Auth State Changed: Deslogado. Usando UID temporário:", newId);
                    }
                    setIsAuthReady(true);
                });
            } catch (error) {
                console.error("ERRO CRÍTICO ao inicializar Firebase ou autenticar:", error);
                setUserId(crypto.randomUUID());
                setIsAuthReady(true);
            }
        };

        if (!isAuthReady) {
            initializeFirebase();
        }
    }, [isAuthReady]);

    // --- FIRESTORE SUBSCRIPTION ---
    useEffect(() => {
        if (!db || !userId || !isAuthReady) return;

        const path = `artifacts/${appId}/users/${userId}/intentions`;
        const intentionsCollection = collection(db, path);
        
        // NOTA: 'orderBy' removido para evitar erros de índice, ordenação feita em memória
        const intentionsQuery = query(intentionsCollection, limit(20));

        const unsubscribe = onSnapshot(intentionsQuery, (snapshot) => {
            try {
                const loadedIntentions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt),
                }));

                // Ordenação manual em memória por data de criação (mais recente primeiro)
                loadedIntentions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                
                setIntentions(loadedIntentions);
                console.log(`DEBUG: Dados carregados: ${loadedIntentions.length} intenções.`);
            } catch (e) {
                console.error("ERRO: Erro ao carregar intenções:", e);
            }
        }, (error) => {
            console.error("ERRO: Erro na subscrição do Firestore:", error);
        });

        return () => unsubscribe();
    }, [db, userId, isAuthReady]);

    // --- FUNÇÕES DE GRAVAÇÃO, IMAGEM E PROCESSAMENTO (Intencional, sem repetição) ---
    // Funções de Gravação (Microfone Real)
    const handleStartRecording = useCallback(async () => {
        if (recordingState.intentionText.trim() === '') {
            setMessage('Digite sua intenção antes de gravar.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            let chunks = [];
            
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            recorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());

                const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);

                setRecordingState(prev => ({
                    ...prev,
                    recordedAudioURL: audioUrl,
                }));
                
                setMessage('Gravação do Microfone Pronta. Clique em "Ouvir" para conferir.');
            };

            recorder.start();
            
            setMessage('Gravação Iniciada. Concentre-se no desejo.');

            const interval = setInterval(() => {
                setRecordingState(prev => ({
                    ...prev,
                    duration: prev.duration + 1,
                }));
            }, 1000);

            setRecordingState(prev => ({
                ...prev,
                isRecording: true,
                duration: 0,
                timerInterval: interval,
                recordedAudioURL: null, 
                mediaRecorder: recorder,
                audioChunks: [], 
            }));

        } catch (error) {
            console.error("ERRO: Não foi possível acessar o microfone:", error);
            setMessage('ERRO: Não foi possível acessar o microfone. Verifique as permissões do dispositivo.');
        }
    }, [recordingState.intentionText]);

    const handleStopRecordingAndGenerate = useCallback(() => {
        if (recordingState.timerInterval) {
            clearInterval(recordingState.timerInterval);
        }
        
        if (recordingState.mediaRecorder && recordingState.mediaRecorder.state !== 'inactive') {
            recordingState.mediaRecorder.stop(); 
        }

        setMessage('Parando gravação... Processando Áudio...');
        
        setRecordingState(prev => ({
            ...prev,
            isRecording: false,
            timerInterval: null,
            mediaRecorder: null,
            audioChunks: [],
        }));
        
    }, [recordingState.timerInterval, recordingState.mediaRecorder]);

    const handlePlayAudio = useCallback(() => {
        if (recordingState.recordedAudioURL) {
            const audio = new Audio(recordingState.recordedAudioURL);
            audio.play().catch(e => console.error("ERRO: Ao tocar áudio:", e));
        }
    }, [recordingState.recordedAudioURL]);

    const handleRemoveAudio = useCallback(() => {
        if (recordingState.recordedAudioURL) {
            URL.revokeObjectURL(recordingState.recordedAudioURL);
        }
        setRecordingState(prev => ({ ...prev, recordedAudioURL: null, duration: 0 }));
        setMessage('Áudio removido. Grave novamente ou prossiga.');
    }, [recordingState.recordedAudioURL]);

    // Funções de Imagem
    const handleImageChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setRecordingState(prev => ({
                    ...prev,
                    imageFile: file,
                    imagePreviewUrl: url,
                    imageBase64: reader.result, 
                }));
                setMessage('Imagem carregada. Imagens grandes podem falhar no envio.');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        if (recordingState.imagePreviewUrl) {
            URL.revokeObjectURL(recordingState.imagePreviewUrl);
        }
        setRecordingState(prev => ({ ...prev, imageFile: null, imagePreviewUrl: null, imageBase64: null }));
        setMessage('Imagem removida. Prossiga para o envio.');
    };

    // Função de Processamento/Envio
    const isProcessable = useMemo(() =>
        recordingState.intentionText.trim() !== '' && recordingState.recordedAudioURL !== null,
        [recordingState.intentionText, recordingState.recordedAudioURL]
    );

    const handleProcessIntention = useCallback(async () => {
        if (!isProcessable) {
            setMessage('Por favor, grave e confirme o texto da intenção antes de alinhar.');
            return;
        }

        setMessage('Alinhando Frequência. Enviando Intenção ao Campo Quântico...');

        const intentionData = {
            text: recordingState.intentionText.trim(),
            audioRecorded: recordingState.recordedAudioURL !== null,
            audioDuration: recordingState.duration,
            imageUrl: recordingState.imageBase64 || null, 
            isManifested: false,
            createdAt: db ? serverTimestamp() : Date.now(),
        };

        try {
            if (db && userId) {
                const path = `artifacts/${appId}/users/${userId}/intentions`;
                await addDoc(collection(db, path), intentionData);
                setMessage('Intenção enviada com sucesso! Aguarde a manifestação.');
            } else {
                console.error("ERRO DE CONEXÃO: Falha na autenticação ou inicialização do Firestore.");
                setMessage('ERRO: Falha ao enviar a intenção. Verifique a conexão e o console.');
            }

            if (db) {
                 setRecordingState({
                    isRecording: false, duration: 0, timerInterval: null, recordedAudioURL: null,
                    intentionText: '', imageFile: null, imagePreviewUrl: null, imageBase64: null,
                    mediaRecorder: null, audioChunks: [],
                });
                setView('history');
            }


        } catch (error) {
            console.error("ERRO AO SALVAR INTENÇÃO NO FIRESTORE:", error);
            setMessage('ERRO: Falha ao enviar a intenção. Verifique a conexão.');
        }

    }, [isProcessable, recordingState, db, userId]);

    // Função de Manifestação
    const handleToggleManifested = useCallback(async (id, currentStatus) => {
        if (!db || !userId) return;

        const path = `artifacts/${appId}/users/${userId}/intentions`;
        const intentionRef = doc(db, path, id);

        try {
            await updateDoc(intentionRef, {
                isManifested: !currentStatus
            });
        } catch (error) {
            console.error("ERRO: Erro ao atualizar status de manifestação:", error);
        }
    }, [db, userId]);

    // CÁLCULO DE NÍVEL VIBRACIONAL
    const vibrationLevel = useMemo(() => {
        if (intentions.length === 0) return 50; 
        const manifestedCount = intentions.filter(i => i.isManifested).length;
        const level = 50 + (manifestedCount / intentions.length) * 50;
        return level;
    }, [intentions]);
    
    // --- FUNÇÃO DE COMPARTILHAMENTO ---
    const handleShare = useCallback(() => {
        const shareData = {
            title: 'Ressona: Alinhamento Vibracional',
            text: 'Descubra seu nível de coerência e manifeste suas intenções com o Ressona App!',
            url: window.location.href, 
        };

        if (navigator.share) {
            navigator.share(shareData)
                .then(() => console.log('DEBUG: Compartilhamento bem-sucedido.'))
                .catch((error) => {
                    console.error('ERRO: Falha ao compartilhar:', error);
                    setMessage('Falha ao compartilhar.');
                });
        } else {
            // Fallback: copia o link completo para o desktop
            const link = `${shareData.title}\n${shareData.text}\n${shareData.url}`;
            // NOTE: Using document.execCommand('copy') instead of navigator.clipboard.writeText for better iframe compatibility
            const tempInput = document.createElement('textarea');
            tempInput.value = link;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);

            setMessage('Link de compartilhamento copiado para a área de transferência!');
        }
        setIsMenuOpen(false); // Fecha o menu após a ação
    }, [setMessage]);

    const handleMenuClick = (targetView) => {
        setView(targetView);
        setIsMenuOpen(false);
    };

    // --- FUNÇÕES DE RENDERIZAÇÃO DE TELAS ---

    const Header = ({ title }) => (
        <header className="py-4 px-6 bg-gray-900 shadow-lg border-b border-purple-500/30 fixed top-0 w-full z-40"> 
            <div className="flex items-center justify-center relative h-full">
                
                {/* Botão de Voltar (Apenas em sub-telas) */}
                {view !== 'dashboard' && (
                    <button
                        onClick={() => setView('dashboard')}
                        className="absolute left-0 text-cyan-400 p-2 rounded-full hover:bg-gray-800 transition duration-150 z-50"
                    >
                        {/* Ícone de Seta para Esquerda */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                )}
                
                {/* Botão de Menu (Apenas no Dashboard) */}
                {view === 'dashboard' && (
                    <button
                        onClick={() => setIsMenuOpen(true)}
                        className="absolute left-0 text-cyan-400 p-2 rounded-full hover:bg-gray-800 transition duration-150 z-50"
                    >
                        {/* Ícone Hamburger */}
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                )}

                <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 text-center">
                    {title}
                </h1>
            </div>
        </header>
    );
    
    const MenuButton = ({ icon, text, onClick }) => (
        <button
            onClick={onClick}
            className="w-full text-left flex items-center p-3 my-1 rounded-lg text-white hover:bg-purple-500/30 transition duration-150"
        >
            <span className="mr-3 text-xl">{icon}</span>
            <span className="font-medium">{text}</span>
        </button>
    );

    // Renderiza o Menu Lateral (Sidebar) com a nova ordem e separação
    const renderSidebar = () => (
        <>
            {/* Overlay de fundo (esmaece a tela principal) */}
            <div
                className={`fixed inset-0 bg-black/50 z-20 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsMenuOpen(false)}
            ></div>

            {/* Menu Lateral */}
            <div
                cl
