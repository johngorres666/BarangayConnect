-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.residents (
  resident_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  first_name character varying NOT NULL,
  middle_name character varying,
  surname character varying NOT NULL,
  suffix character varying,
  birth_date date NOT NULL,
  address text NOT NULL,
  phone character varying,
  email character varying UNIQUE,
  profile_picture_path text,
  registration_status character varying NOT NULL DEFAULT 'pending'::character varying,
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  password_hash text,
  CONSTRAINT residents_pkey PRIMARY KEY (resident_id)
);
CREATE TABLE public.service_requests (
  request_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  resident_id integer NOT NULL,
  service_type character varying NOT NULL,
  description text NOT NULL,
  request_status character varying NOT NULL DEFAULT 'pending'::character varying CHECK (request_status::text = ANY (ARRAY['pending'::character varying::text, 'approved'::character varying::text, 'rejected'::character varying::text, 'completed'::character varying::text])),
  submitted_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT service_requests_pkey PRIMARY KEY (request_id),
  CONSTRAINT fk_service_requests_resident FOREIGN KEY (resident_id) REFERENCES public.residents(resident_id)
);
CREATE TABLE public.staff_users (
  staff_id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  full_name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role character varying NOT NULL DEFAULT 'staff'::character varying CHECK (role::text = ANY (ARRAY['staff'::character varying::text, 'admin'::character varying::text])),
  created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT staff_users_pkey PRIMARY KEY (staff_id)
);