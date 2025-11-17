import { useState, useCallback } from 'react'

export const useFormValidation = (initialValues, validationRules) => {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  const validateField = useCallback((name, value) => {
    const rules = validationRules[name]
    if (!rules) return ''

    for (const rule of rules) {
      const error = rule(value, values)
      if (error) return error
    }
    return ''
  }, [validationRules, values])

  const validateForm = useCallback(() => {
    const newErrors = {}
    let isValid = true

    Object.keys(validationRules).forEach(name => {
      const error = validateField(name, values[name])
      if (error) {
        newErrors[name] = error
        isValid = false
      }
    })

    setErrors(newErrors)
    return isValid
  }, [values, validationRules, validateField])

  const handleChange = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }, [errors])

  const handleBlur = useCallback((name) => {
    setTouched(prev => ({ ...prev, [name]: true }))
    const error = validateField(name, values[name])
    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }))
    }
  }, [values, validateField])

  const resetForm = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  const setFieldValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateForm,
    resetForm,
    setFieldValue,
    isValid: Object.keys(errors).length === 0
  }
}

// Validation rules
export const validationRules = {
  required: (message = 'Este campo es requerido') => (value) => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return message
    }
    return ''
  },

  minLength: (min, message) => (value) => {
    if (value && value.length < min) {
      return message || `Debe tener al menos ${min} caracteres`
    }
    return ''
  },

  maxLength: (max, message) => (value) => {
    if (value && value.length > max) {
      return message || `No puede tener más de ${max} caracteres`
    }
    return ''
  },

  pattern: (regex, message = 'Formato inválido') => (value) => {
    if (value && !regex.test(value)) {
      return message
    }
    return ''
  },

  url: (message = 'URL inválida') => (value) => {
    if (value) {
      try {
        new URL(value)
      } catch {
        return message
      }
    }
    return ''
  },

  mqttTopic: (message = 'Topic MQTT inválido') => (value) => {
    if (value) {
      // MQTT topic validation: no leading/trailing slashes, no empty levels
      const parts = value.split('/')
      if (parts.some(part => part === '')) {
        return message || 'Topic no puede tener niveles vacíos'
      }
      if (value.startsWith('/') || value.endsWith('/')) {
        return message || 'Topic no puede empezar o terminar con /'
      }
    }
    return ''
  },

  custom: (validator, message) => (value, allValues) => {
    if (typeof validator === 'function') {
      return validator(value, allValues) ? '' : (message || 'Valor inválido')
    }
    return ''
  }
}