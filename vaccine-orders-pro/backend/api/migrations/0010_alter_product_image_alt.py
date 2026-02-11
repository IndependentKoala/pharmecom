# Generated migration for making image_alt optional

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0009_orderstatushistory"),
    ]

    operations = [
        migrations.AlterField(
            model_name='product',
            name='image_alt',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
    ]
