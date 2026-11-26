/* ============================================================================
   CONFIG.JS — CẤU HÌNH TẬP TRUNG TOÀN ỨNG DỤNG QUẢN LÝ KHO
   Single Source of Truth cho toàn bộ API Endpoints & Hằng số vận hành
   ============================================================================ */
(function (global) {
  'use strict';

  const APP_CONFIG = {
    API_TIMEOUT_MS: 30000,
    ENDPOINTS: {
      APP_QR: "https://script.google.com/macros/s/AKfycbzXjzccld3X04iJgIpEvKm01in0QT0i7tkjar_oJ6K5-sBGdm9xibe7Mu4UB3mWtha5-w/exec",
      CX1_CX5_QR: "https://script.google.com/macros/s/AKfycbzk7afcuHDOTnL6QSIQ0ZgT-CSiIDNZ8h5S8_IkGXahc7PQRvqZKpLpjkBphioXAyzDKQ/exec",
      TON_KHO_CX5: "https://script.google.com/macros/s/AKfycbyOhUM1KCg0eUsj-tBPDFnyJXS_PDlxcsRWRqzR7ZdoX9ZCMRlvPApouk9Jn6yghVS1xg/exec",
      BTP: "https://script.google.com/macros/s/AKfycbxjnWLrJXZk1MJN4bSXdf72Wly7Of1Rc7iRtUNpcKk3iZDkxk-N1W7mE965tNMyhA9z1Q/exec"
    },
    getAppToken: function () {
      try {
        return localStorage.getItem("app_api_token") || "";
      } catch (e) {
        return "";
      }
    },
    getNguoiThaoTac: function () {
      try {
        return (localStorage.getItem("tenNhanVien") || localStorage.getItem("ten_nguoi_dung") || "Admin").trim() || "Admin";
      } catch (e) {
        return "Admin";
      }
    }
  };

  global.APP_CONFIG = APP_CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
