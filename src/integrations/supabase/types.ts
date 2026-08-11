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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_findings: {
        Row: {
          action_key: string | null
          area: string
          authorized_at: string | null
          authorized_by: string | null
          cause: string
          created_at: string
          evidence: Json
          id: string
          impact: string
          priority: string
          recommendation: string
          scan_id: string | null
          sensitive: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action_key?: string | null
          area?: string
          authorized_at?: string | null
          authorized_by?: string | null
          cause?: string
          created_at?: string
          evidence?: Json
          id?: string
          impact?: string
          priority?: string
          recommendation?: string
          scan_id?: string | null
          sensitive?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_key?: string | null
          area?: string
          authorized_at?: string | null
          authorized_by?: string | null
          cause?: string
          created_at?: string
          evidence?: Json
          id?: string
          impact?: string
          priority?: string
          recommendation?: string
          scan_id?: string | null
          sensitive?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_findings_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "ai_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_remediations: {
        Row: {
          action_key: string
          applied: string
          authorized_at: string
          authorized_by: string | null
          cause: string
          confirmed_sensitive: boolean
          created_at: string
          detail: string
          finding_id: string | null
          id: string
          outcome: string
          problem: string
          recommendations: string
          targets: string
          tests: Json
        }
        Insert: {
          action_key: string
          applied?: string
          authorized_at?: string
          authorized_by?: string | null
          cause?: string
          confirmed_sensitive?: boolean
          created_at?: string
          detail?: string
          finding_id?: string | null
          id?: string
          outcome?: string
          problem?: string
          recommendations?: string
          targets?: string
          tests?: Json
        }
        Update: {
          action_key?: string
          applied?: string
          authorized_at?: string
          authorized_by?: string | null
          cause?: string
          confirmed_sensitive?: boolean
          created_at?: string
          detail?: string
          finding_id?: string | null
          id?: string
          outcome?: string
          problem?: string
          recommendations?: string
          targets?: string
          tests?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_remediations_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "ai_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_scans: {
        Row: {
          created_at: string
          findings_count: number
          health_score: number
          id: string
          metrics: Json
          model: string | null
          requested_by: string | null
          summary: string
          trigger: string
        }
        Insert: {
          created_at?: string
          findings_count?: number
          health_score?: number
          id?: string
          metrics?: Json
          model?: string | null
          requested_by?: string | null
          summary?: string
          trigger?: string
        }
        Update: {
          created_at?: string
          findings_count?: number
          health_score?: number
          id?: string
          metrics?: Json
          model?: string | null
          requested_by?: string | null
          summary?: string
          trigger?: string
        }
        Relationships: []
      }
      app_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          id: string
          kind: string
          metadata: Json
          name: string
          path: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: string
          metadata?: Json
          name: string
          path?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          id?: string
          kind?: string
          metadata?: Json
          name?: string
          path?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      content_hashtags: {
        Row: {
          author_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          hashtag_id: string
          id: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          hashtag_id: string
          id?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          hashtag_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_hashtags_hashtag_id_fkey"
            columns: ["hashtag_id"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_settings: {
        Row: {
          archived: boolean
          created_at: string
          peer_id: string
          pinned: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          peer_id: string
          pinned?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          peer_id?: string
          pinned?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_profile_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_profile_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_join_requests: {
        Row: {
          created_at: string
          group_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_join_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          last_seen_at: string
          notifications_muted: boolean
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          last_seen_at?: string
          notifications_muted?: boolean
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          last_seen_at?: string
          notifications_muted?: boolean
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          forwarded: boolean
          group_id: string
          id: string
          is_announcement: boolean
          media_type: string | null
          media_url: string | null
          mentions: string[]
          pinned: boolean
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          forwarded?: boolean
          group_id: string
          id?: string
          is_announcement?: boolean
          media_type?: string | null
          media_url?: string | null
          mentions?: string[]
          pinned?: boolean
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          forwarded?: boolean
          group_id?: string
          id?: string
          is_announcement?: boolean
          media_type?: string | null
          media_url?: string | null
          mentions?: string[]
          pinned?: boolean
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          owner_id: string
          photo_url: string | null
          rules: string | null
          updated_at: string
          who_can_edit_info: string
          who_can_invite: string
          who_can_send: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          owner_id: string
          photo_url?: string | null
          rules?: string | null
          updated_at?: string
          who_can_edit_info?: string
          who_can_invite?: string
          who_can_send?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          owner_id?: string
          photo_url?: string | null
          rules?: string | null
          updated_at?: string
          who_can_edit_info?: string
          who_can_invite?: string
          who_can_send?: string
        }
        Relationships: []
      }
      hashtags: {
        Row: {
          created_at: string
          id: string
          tag: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          tag: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          tag?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          deleted_for: string[]
          delivered_at: string | null
          edited_at: string | null
          forwarded: boolean
          id: string
          media_type: string | null
          media_url: string | null
          read_at: string | null
          recipient_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          deleted_for?: string[]
          delivered_at?: string | null
          edited_at?: string | null
          forwarded?: boolean
          id?: string
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          recipient_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          deleted_for?: string[]
          delivered_at?: string | null
          edited_at?: string | null
          forwarded?: boolean
          id?: string
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          recipient_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_profile_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_articles: {
        Row: {
          category: string
          content: string | null
          country: string | null
          created_at: string
          id: string
          image_url: string | null
          is_important: boolean
          published_at: string
          relevance: number
          repost_count: number
          share_count: number
          source: string
          source_url: string | null
          summary: string | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          category?: string
          content?: string | null
          country?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_important?: boolean
          published_at?: string
          relevance?: number
          repost_count?: number
          share_count?: number
          source?: string
          source_url?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          category?: string
          content?: string | null
          country?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_important?: boolean
          published_at?: string
          relevance?: number
          repost_count?: number
          share_count?: number
          source?: string
          source_url?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      news_comments: {
        Row: {
          article_id: string
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          article_id: string
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          article_id?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_comments_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "news_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      news_likes: {
        Row: {
          article_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_likes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_saves: {
        Row: {
          article_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_saves_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          entity_id: string | null
          id: string
          kind: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          kind: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_profile_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_saves: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          share_count: number
          tag: string | null
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          share_count?: number
          tag?: string | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          share_count?: number
          tag?: string | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          city: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          image_url: string | null
          price: number
          seller_id: string
          shop_id: string | null
          stock: number | null
          title: string
        }
        Insert: {
          category?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          price?: number
          seller_id: string
          shop_id?: string | null
          stock?: number | null
          title: string
        }
        Update: {
          category?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          price?: number
          seller_id?: string
          shop_id?: string | null
          stock?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_seller_profile_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allow_photo_download: boolean
          allow_video_download: boolean
          avatar_url: string | null
          badge: string
          bio: string | null
          city: string | null
          cover_url: string | null
          created_at: string
          follower_boost: number
          full_name: string
          handle: string | null
          id: string
          language: string
          last_seen_at: string | null
          phone: string | null
          role: string | null
          show_last_seen: boolean
          show_online: boolean
          title: string | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          allow_photo_download?: boolean
          allow_video_download?: boolean
          avatar_url?: string | null
          badge?: string
          bio?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          follower_boost?: number
          full_name?: string
          handle?: string | null
          id: string
          language?: string
          last_seen_at?: string | null
          phone?: string | null
          role?: string | null
          show_last_seen?: boolean
          show_online?: boolean
          title?: string | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          allow_photo_download?: boolean
          allow_video_download?: boolean
          avatar_url?: string | null
          badge?: string
          bio?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          follower_boost?: number
          full_name?: string
          handle?: string | null
          id?: string
          language?: string
          last_seen_at?: string | null
          phone?: string | null
          role?: string | null
          show_last_seen?: boolean
          show_online?: boolean
          title?: string | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          reason: string
          reporter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          reason: string
          reporter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          kind: string
          metadata: Json
          resolved: boolean
          resolved_at: string | null
          severity: string
          subject: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          metadata?: Json
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          subject?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          metadata?: Json
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
          subject?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shops: {
        Row: {
          address: string | null
          city: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          hours: string | null
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          hours?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          hours?: string | null
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          allow_share: boolean
          author_id: string
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
        }
        Insert: {
          allow_share?: boolean
          author_id: string
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url: string
        }
        Update: {
          allow_share?: boolean
          author_id?: string
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          story_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          story_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          story_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_comments_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "story_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_likes: {
        Row: {
          created_at: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          created_at: string
          story_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          story_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          story_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_viewer_profile_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_post_in_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hashtag_posts: {
        Args: { _limit?: number; _tag: string }
        Returns: {
          author_id: string
          body: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          share_count: number
          tag: string | null
          updated_at: string
          view_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      increment_news_counter: {
        Args: { _article_id: string; _field: string }
        Returns: number
      }
      increment_share: { Args: { _post_id: string }; Returns: number }
      increment_view: { Args: { _post_id: string }; Returns: number }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_public: { Args: { _group_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_security_event: {
        Args: {
          _detail?: string
          _kind: string
          _metadata?: Json
          _severity: string
          _subject?: string
          _title: string
        }
        Returns: string
      }
      mark_messages_delivered: { Args: never; Returns: number }
      owner_dashboard: { Args: never; Returns: Json }
      presence_of: { Args: { _user_id: string }; Returns: Json }
      resolve_security_event: {
        Args: { _id: string; _resolved: boolean }
        Returns: boolean
      }
      search_hashtags: {
        Args: { _limit?: number; _term?: string }
        Returns: {
          id: string
          tag: string
          usage_count: number
        }[]
      }
      set_user_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      sync_hashtags: {
        Args: {
          _author_id: string
          _entity_id: string
          _entity_type: string
          _text: string
        }
        Returns: undefined
      }
      touch_presence: { Args: never; Returns: undefined }
      trending_overview: { Args: { _limit?: number }; Returns: Json }
    }
    Enums: {
      app_role: "owner" | "admin" | "moderator" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["owner", "admin", "moderator", "user"],
    },
  },
} as const
