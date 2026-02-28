import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ItemPhoto {
  id: string;
  fileName: string;
  storagePath: string;
  url: string;
}

const mapPhotos = (data: any[]): ItemPhoto[] =>
  (data || []).map((p) => {
    const { data: urlData } = supabase.storage.from("lead-photos").getPublicUrl(p.storage_path);
    return { id: p.id, fileName: p.file_name, storagePath: p.storage_path, url: urlData.publicUrl };
  });

export const useLeadItemPhotos = (leadId: string, itemId: string) => {
  const queryClient = useQueryClient();
  const key = ["lead-item-photos", leadId, itemId];

  const { data: photos = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_photos")
        .select("id, file_name, storage_path")
        .eq("lead_id", leadId)
        .eq("lead_item_id", itemId);
      if (error) throw error;
      return mapPhotos(data);
    },
    enabled: !!leadId && !!itemId,
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const path = `${leadId}/items/${itemId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: storageErr } = await supabase.storage.from("lead-photos").upload(path, file);
        if (storageErr) throw storageErr;
        const { error: dbErr } = await supabase.from("lead_photos").insert({
          lead_id: leadId,
          lead_item_id: itemId,
          storage_path: path,
          file_name: file.name,
        });
        if (dbErr) throw dbErr;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (photo: { id: string; storagePath: string }) => {
      await supabase.storage.from("lead-photos").remove([photo.storagePath]);
      const { error } = await supabase.from("lead_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return { photos, upload, remove };
};

export const useOrphanedPhotos = (leadId: string) => {
  const { data: photos = [] } = useQuery({
    queryKey: ["orphaned-photos", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_photos")
        .select("id, file_name, storage_path")
        .eq("lead_id", leadId)
        .is("lead_item_id", null);
      if (error) throw error;
      return mapPhotos(data);
    },
    enabled: !!leadId,
  });
  return { photos };
};
