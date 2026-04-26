import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

export function useAvatarUpload() {
  const uploading = ref(false)
  const error = ref<string | null>(null)

  async function upload(profileId: string, file: File): Promise<string> {
    error.value = null

    if (!ALLOWED_TYPES.includes(file.type)) {
      const message = 'Formato inválido. Use JPG, PNG ou WebP.'
      error.value = message
      throw new Error(message)
    }

    if (file.size > MAX_SIZE_BYTES) {
      const message = 'Arquivo muito grande. Limite de 2 MB.'
      error.value = message
      throw new Error(message)
    }

    uploading.value = true
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${profileId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      return data.publicUrl
    } finally {
      uploading.value = false
    }
  }

  return { upload, uploading, error }
}
