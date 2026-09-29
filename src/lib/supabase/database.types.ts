export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          acao: string
          ator: string
          criado_em: string
          ficha_id: string | null
          id: number
          ip: unknown
          user_agent: string | null
        }
        Insert: {
          acao: string
          ator: string
          criado_em?: string
          ficha_id?: string | null
          id?: number
          ip?: unknown
          user_agent?: string | null
        }
        Update: {
          acao?: string
          ator?: string
          criado_em?: string
          ficha_id?: string | null
          id?: number
          ip?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          atualizado_em: string
          criado_em: string
          dados_ficha: Json
          dados_rd: Json
          email: string | null
          id: string
          nome: string
          rd_id: string
          ultima_importacao_id: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          dados_ficha: Json
          dados_rd: Json
          email?: string | null
          id?: string
          nome: string
          rd_id: string
          ultima_importacao_id?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          dados_ficha?: Json
          dados_rd?: Json
          email?: string | null
          id?: string
          nome?: string
          rd_id?: string
          ultima_importacao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_ultima_importacao_id_fkey"
            columns: ["ultima_importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoras: {
        Row: {
          admin: boolean
          criado_em: string
          email: string | null
          id: string
          nome: string
        }
        Insert: {
          admin?: boolean
          criado_em?: string
          email?: string | null
          id: string
          nome: string
        }
        Update: {
          admin?: boolean
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      convites_equipe: {
        Row: {
          criado_em: string
          criado_por: string | null
          email: string
          expira_em: string
          id: string
          nome: string | null
          revogado_em: string | null
          tipo: Database["public"]["Enums"]["tipo_convite"]
          token_hash: string
          usado_em: string | null
          usuario_id: string | null
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          email: string
          expira_em: string
          id?: string
          nome?: string | null
          revogado_em?: string | null
          tipo: Database["public"]["Enums"]["tipo_convite"]
          token_hash: string
          usado_em?: string | null
          usuario_id?: string | null
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          email?: string
          expira_em?: string
          id?: string
          nome?: string | null
          revogado_em?: string | null
          tipo?: Database["public"]["Enums"]["tipo_convite"]
          token_hash?: string
          usado_em?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convites_equipe_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "consultoras"
            referencedColumns: ["id"]
          },
        ]
      }
      ficha_edicoes: {
        Row: {
          campo: string
          criado_em: string
          ficha_id: string
          id: number
          origem: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          campo: string
          criado_em?: string
          ficha_id: string
          id?: number
          origem?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          campo?: string
          criado_em?: string
          ficha_id?: string
          id?: number
          origem?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ficha_edicoes_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas"
            referencedColumns: ["id"]
          },
        ]
      }
      fichas: {
        Row: {
          aprovada_em: string | null
          atualizado_em: string
          campo_em_foco: string | null
          cliente_id: string
          cliente_visto_em: string | null
          concluida_em: string | null
          criado_em: string
          criado_por: string | null
          dados_atuais: Json
          dados_originais: Json
          dados_revisados: Json | null
          id: string
          revisado_em: string | null
          revisado_por: string | null
          status: Database["public"]["Enums"]["status_ficha"]
        }
        Insert: {
          aprovada_em?: string | null
          atualizado_em?: string
          campo_em_foco?: string | null
          cliente_id: string
          cliente_visto_em?: string | null
          concluida_em?: string | null
          criado_em?: string
          criado_por?: string | null
          dados_atuais: Json
          dados_originais: Json
          dados_revisados?: Json | null
          id?: string
          revisado_em?: string | null
          revisado_por?: string | null
          status?: Database["public"]["Enums"]["status_ficha"]
        }
        Update: {
          aprovada_em?: string | null
          atualizado_em?: string
          campo_em_foco?: string | null
          cliente_id?: string
          cliente_visto_em?: string | null
          concluida_em?: string | null
          criado_em?: string
          criado_por?: string | null
          dados_atuais?: Json
          dados_originais?: Json
          dados_revisados?: Json | null
          id?: string
          revisado_em?: string | null
          revisado_por?: string | null
          status?: Database["public"]["Enums"]["status_ficha"]
        }
        Relationships: [
          {
            foreignKeyName: "fichas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fichas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "consultoras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fichas_revisado_por_fkey"
            columns: ["revisado_por"]
            isOneToOne: false
            referencedRelation: "consultoras"
            referencedColumns: ["id"]
          },
        ]
      }
      importacoes: {
        Row: {
          arquivo_nome: string
          atualizados: number
          criado_em: string
          criados: number
          erros: Json
          id: string
          importado_por: string | null
          total_linhas: number
        }
        Insert: {
          arquivo_nome: string
          atualizados?: number
          criado_em?: string
          criados?: number
          erros?: Json
          id?: string
          importado_por?: string | null
          total_linhas: number
        }
        Update: {
          arquivo_nome?: string
          atualizados?: number
          criado_em?: string
          criados?: number
          erros?: Json
          id?: string
          importado_por?: string | null
          total_linhas?: number
        }
        Relationships: [
          {
            foreignKeyName: "importacoes_importado_por_fkey"
            columns: ["importado_por"]
            isOneToOne: false
            referencedRelation: "consultoras"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit: {
        Row: {
          chave: string
          contagem: number
          janela_inicio: string
        }
        Insert: {
          chave: string
          contagem: number
          janela_inicio: string
        }
        Update: {
          chave?: string
          contagem?: number
          janela_inicio?: string
        }
        Relationships: []
      }
      tokens_acesso: {
        Row: {
          criado_em: string
          expira_em: string
          ficha_id: string
          id: string
          revogado_em: string | null
          token_hash: string
          ultimo_acesso_em: string | null
          usos: number
        }
        Insert: {
          criado_em?: string
          expira_em: string
          ficha_id: string
          id?: string
          revogado_em?: string | null
          token_hash: string
          ultimo_acesso_em?: string | null
          usos?: number
        }
        Update: {
          criado_em?: string
          expira_em?: string
          ficha_id?: string
          id?: string
          revogado_em?: string | null
          token_hash?: string
          ultimo_acesso_em?: string | null
          usos?: number
        }
        Relationships: [
          {
            foreignKeyName: "tokens_acesso_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atualizar_campo: {
        Args: {
          p_campo: string
          p_ficha: string
          p_origem: string
          p_valor: Json
        }
        Returns: Json
      }
      consumir_rate_limit: {
        Args: { p_chave: string; p_janela_seg: number; p_limite: number }
        Returns: boolean
      }
      definir_admin: {
        Args: { p_admin: boolean; p_alvo: string }
        Returns: undefined
      }
      gerar_link: {
        Args: { p_expira_em: string; p_ficha_id: string; p_token_hash: string }
        Returns: string
      }
      is_consultora: { Args: never; Returns: boolean }
      marcar_revisado: {
        Args: { p_consultora: string; p_ficha: string }
        Returns: string
      }
    }
    Enums: {
      status_ficha:
        | "gerada"
        | "enviada"
        | "aberta"
        | "em_preenchimento"
        | "concluida"
        | "aprovada"
        | "cancelada"
      tipo_convite: "convite" | "nova_senha"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      status_ficha: [
        "gerada",
        "enviada",
        "aberta",
        "em_preenchimento",
        "concluida",
        "aprovada",
        "cancelada",
      ],
      tipo_convite: ["convite", "nova_senha"],
    },
  },
} as const
