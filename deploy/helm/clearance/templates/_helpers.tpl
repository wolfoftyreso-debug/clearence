{{/* Namn och etiketter - en plats, så inget glider isär. */}}

{{- define "clearance.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "clearance.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "clearance.labels" -}}
app.kubernetes.io/name: {{ include "clearance.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: clearance
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{/* Per-komponent selector-etiketter. Anropas med (dict "ctx" . "component" "api"). */}}
{{- define "clearance.selectorLabels" -}}
app.kubernetes.io/name: {{ include "clearance.name" .ctx }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/* Namnet på hemligheten - befintlig eller den chartet skapar. */}}
{{- define "clearance.secretName" -}}
{{- if .Values.secret.existingSecret -}}
{{- .Values.secret.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "clearance.fullname" .) -}}
{{- end -}}
{{- end -}}

{{/* Dokumentlagringen (S3/MinIO). minio.enabled ger interna standarder;
     documents.* överlagrar för AWS S3 eller extern MinIO. Tom hink => API:t
     rapporterar storage:false och /url svarar 404 (byggt, men ej anslutet). */}}
{{- define "clearance.documents.enabled" -}}
{{- if or .Values.minio.enabled .Values.documents.bucket -}}true{{- end -}}
{{- end -}}

{{- define "clearance.documents.bucket" -}}
{{- default .Values.minio.bucket .Values.documents.bucket -}}
{{- end -}}

{{/* Tom = AWS S3. Satt = MinIO/extern (kräver forcePathStyle). När minio.enabled
     pekar den på den interna tjänsten om inget annat angetts. */}}
{{- define "clearance.documents.endpoint" -}}
{{- if .Values.documents.endpoint -}}
{{- .Values.documents.endpoint -}}
{{- else if .Values.minio.enabled -}}
{{- printf "http://%s-minio:9000" (include "clearance.fullname" .) -}}
{{- end -}}
{{- end -}}

{{- define "clearance.documents.forcePathStyle" -}}
{{- if .Values.documents.forcePathStyle -}}
{{- .Values.documents.forcePathStyle -}}
{{- else if (include "clearance.documents.endpoint" .) -}}true{{- else -}}false{{- end -}}
{{- end -}}

{{/* Hemligheten med S3-nycklarna. Ärver MinIO:s rotcredentials om inget eget satts. */}}
{{- define "clearance.documents.secretName" -}}
{{- if .Values.documents.credentials.existingSecret -}}
{{- .Values.documents.credentials.existingSecret -}}
{{- else -}}
{{- .Values.minio.auth.existingSecret -}}
{{- end -}}
{{- end -}}

{{/* Den fullständiga avbildsreferensen för en komponent. */}}
{{- define "clearance.image" -}}
{{- $ := .ctx -}}
{{- $repo := .repository -}}
{{- $tag := default $.Values.image.tag $.Chart.AppVersion -}}
{{- printf "%s/%s:%s" $.Values.image.registry $repo $tag -}}
{{- end -}}
