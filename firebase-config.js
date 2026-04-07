// Configurações do Portal-Festas-Contagem
const firebaseConfig = {
  apiKey: "AIzaSyAH6PXmb2_q5NJeBm-mEKB0NaOsYWAdi34",
  authDomain: "portal-festas-contagem.firebaseapp.com",
  databaseURL: "https://portal-festas-contagem-default-rtdb.firebaseio.com",
  projectId: "portal-festas-contagem",
  storageBucket: "portal-festas-contagem.firebasestorage.app",
  messagingSenderId: "561179713421",
  appId: "1:561179713421:web:69e682577cc787ef69e7c4",
  measurementId: "G-XR8BGR7CFX"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

// Atalho para o Banco de Dados
const database = firebase.database();
