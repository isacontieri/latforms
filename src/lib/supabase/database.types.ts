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
      fichas: {
        Row: {
          aprovada_em: string | null
          cliente_id: string
          criado_em: string
          criado_por: string | null
          dados_respondidos: Json | null
          dados_snapshot: Json
          id: string
          motivo_correcao: string | null
          pdf_respondido_path: string | null
          respondida_em: string | null
          status: Database["public"]["Enums"]["status_ficha"]
          versao: number
        }
        Insert: {
          aprovada_em?: string | null
          cliente_id: string
          criado_em?: string
          criado_por?: string | null
          dados_respondidos?: Json | null
          dados_snapshot: Json
          id?: string
          motivo_correcao?: string | null
          pdf_respondido_path?: string | null
          respondida_em?: string | null
          status?: Database["public"]["Enums"]["status_ficha"]
          versao?: number
        }
        Update: {
          aprovada_em?: string | null
          cliente_id?: string
          criado_em?: string
          criado_por?: string | null
          dados_respondidos?: Json | null
          dados_snapshot?: Json
          id?: string
          motivo_correcao?: string | null
          pdf_respondido_path?: string | null
          respondida_em?: string | null
          status?: Database["public"]["Enums"]["status_ficha"]
          versao?: number
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
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          criado_em?: string
          id: string
          nome: string
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
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
            referencedRelation: "funcionarios"
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
      consumir_rate_limit: {
        Args: { p_chave: string; p_janela_seg: number; p_limite: number }
        Returns: boolean
      }
      gerar_link: {
        Args: { p_expira_em: string; p_ficha_id: string; p_token_hash: string }
        Returns: string
      }
      is_funcionario: { Args: never; Returns: boolean }
    }
    Enums: {
      status_ficha:
        | "gerada"
        | "enviada"
        | "aberta"
        | "respondida"
        | "correcao_solicitada"
        | "aprovada"
        | "cancelada"
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
        "respondida",
        "correcao_solicitada",
        "aprovada",
        "cancelada",
      ],
    },
  },
} as const
