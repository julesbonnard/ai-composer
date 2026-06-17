import { reactive } from 'vue'

// État réactif du chargement des modèles locaux, partagé par TOUS les moteurs
// navigateur (transformers.js, WebLLM, MediaPipe) et consommé par LocalModelLoader.vue.
// Deux modes de report :
//  - reportFileProgress : progression fichier par fichier (transformers.js diffuse un
//    événement par fichier téléchargé) ;
//  - reportOverallProgress : progression globale unique (WebLLM/MediaPipe ne donnent
//    qu'un pourcentage agrégé).

export interface FileProgress {
  name: string
  progress: number // 0..100
  status: string
}

export const localModelState = reactive({
  loading: false,
  modelId: '',
  files: {} as Record<string, FileProgress>
})

function recomputeLoading() {
  const files = Object.values(localModelState.files)
  localModelState.loading = files.length > 0 && files.some((f) => f.progress < 100)
  // Une fois tout téléchargé, on laisse l'UI afficher 100% puis on nettoie.
  if (!localModelState.loading && files.length > 0) {
    setTimeout(() => {
      localModelState.files = {}
    }, 1200)
  }
}

// Progression fichier par fichier (transformers.js).
export function reportFileProgress(model: string, data: any) {
  localModelState.modelId = model
  if (data?.status === 'ready') {
    localModelState.files = {}
    localModelState.loading = false
    return
  }
  if (!data?.file) return
  localModelState.files[data.file] = {
    name: data.file,
    progress: data.status === 'done' ? 100 : Math.round(data.progress ?? 0),
    status: data.status
  }
  recomputeLoading()
}

// Progression globale unique (WebLLM, MediaPipe).
export function reportOverallProgress(model: string, progress: number, status: string) {
  localModelState.modelId = model
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  if (pct >= 100 || status === 'ready') {
    clearProgress()
    return
  }
  localModelState.files = { [model]: { name: status || model, progress: pct, status } }
  localModelState.loading = true
}

export function clearProgress() {
  localModelState.files = {}
  localModelState.loading = false
}
