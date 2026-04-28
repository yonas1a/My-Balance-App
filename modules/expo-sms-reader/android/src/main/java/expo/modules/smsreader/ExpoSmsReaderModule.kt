package expo.modules.smsreader

import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoSmsReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoSmsReader")

    AsyncFunction("getMessages") { limit: Int ->
      val messages = mutableListOf<Map<String, String>>()
      val context = appContext.reactContext ?: return@AsyncFunction messages

      val cursor = context.contentResolver.query(
          Uri.parse("content://sms/inbox"),
          arrayOf("address", "body", "date"),
          null,
          null,
          "date DESC"
      )

      cursor?.use {
          var count = 0
          if (it.moveToFirst()) {
              do {
                  val address = it.getString(it.getColumnIndexOrThrow("address")) ?: ""
                  val body = it.getString(it.getColumnIndexOrThrow("body")) ?: ""
                  val date = it.getString(it.getColumnIndexOrThrow("date")) ?: ""

                  messages.add(mapOf(
                      "address" to address,
                      "body" to body,
                      "date" to date
                  ))
                  count++
              } while (it.moveToNext() && count < limit)
          }
      }
      return@AsyncFunction messages
    }
  }
}
