export const apiErrorMessages: Record<number, string> = {
  400: "Permintaan tidak valid. Periksa kembali data Anda.",
  401: "Sesi tidak valid. Silakan masuk kembali.",
  403: "Anda tidak memiliki izin untuk melakukan tindakan ini.",
  404: "Layanan yang diminta tidak ditemukan.",
  408: "Permintaan ke server melewati batas waktu.",
  429: "Terlalu banyak permintaan. Silakan coba lagi nanti.",
  500: "Server mengalami masalah. Silakan coba lagi nanti.",
  502: "Layanan sedang tidak tersedia. Silakan coba lagi nanti.",
  503: "Layanan sedang tidak tersedia. Silakan coba lagi nanti.",
  504: "Server tidak merespons tepat waktu.",
}
