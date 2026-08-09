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

{{/* Den fullständiga avbildsreferensen för en komponent. */}}
{{- define "clearance.image" -}}
{{- $ := .ctx -}}
{{- $repo := .repository -}}
{{- $tag := default $.Values.image.tag $.Chart.AppVersion -}}
{{- printf "%s/%s:%s" $.Values.image.registry $repo $tag -}}
{{- end -}}
